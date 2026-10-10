import Decimal from "decimal.js";
import type { ApprovalRequest, ApprovalWording, DecisionContext } from "@/lib/engines/approval.engine";
import { readAmount, readBsDate, type ImportColumn, type RowIssue, type SheetRow } from "@/lib/engines/import.engine";
import type { CheckerMode } from "@/lib/engines/payroll-control.engine";
import { isPayMonth } from "@/lib/utils/pay-month";
import type { ApprovalFlow, ApproverInfo, FlowLevel } from "@/lib/types/approval";

// Loans and salary advances (4.10): pure rules. A loan is asked for — by HR, or by the employee in
// self-service for the types that allow it — and approved by someone else through the approval
// engine (S21: never one's own; never the person who asked, except an administrator's Final
// approve in the default maker-checker mode). An approved request is disbursed into a loan with
// its terms frozen. Payroll recovers it: each regular payslip carries a line per running loan (the
// installment, or what is left), posted to the loan when the run is locked. Repaid in cash,
// recovered by the final settlement or written off, it closes. Nothing here touches the database.

const ROUND_UP = Decimal.ROUND_UP;
const dec = (v: Decimal.Value | null | undefined) => new Decimal(v || 0);
/** "1,25,000.00" */
export const npr = (v: Decimal.Value) => dec(v).toNumber().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthsText = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NaN;
};
const twoDecimals = (n: number) => Number.isFinite(n) && new Decimal(n).decimalPlaces() <= 2;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---- loan types -----------------------------------------------------------------------------

export const LOAN_KINDS = ["loan", "advance"] as const;
export type LoanKind = (typeof LOAN_KINDS)[number];
export const asLoanKind = (v: unknown): LoanKind => (v === "advance" ? "advance" : "loan");
export const KIND_LABEL: Record<LoanKind, string> = { loan: "Loan", advance: "Salary advance" };

/** The longest a type may run: a salary advance is recovered within a year. */
export const MAX_INSTALLMENTS: Record<LoanKind, number> = { loan: 240, advance: 12 };

export interface LoanTypeForm {
  name: string;
  nameNp: string;
  kind: LoanKind;
  /** A fixed limit (0: none). */
  maxAmount: number;
  /** Months of basic + grade a request may reach (0: no such limit). */
  maxSalaryMonths: number;
  maxInstallments: number;
  /** Flat, once on the amount, in %. */
  interestRate: number;
  /** Completed months of service before someone may ask (0: from joining). */
  eligibleAfterMonths: number;
  /** Employees ask for it themselves in self-service. */
  selfService: boolean;
  isActive: boolean;
}

export function normalizeTypeForm(raw: unknown): LoanTypeForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = asLoanKind(r.kind);
  return {
    name: text(r.name, 100),
    nameNp: text(r.nameNp, 100),
    kind,
    maxAmount: num(r.maxAmount ?? 0),
    maxSalaryMonths: num(r.maxSalaryMonths ?? 0),
    maxInstallments: num(r.maxInstallments),
    // A salary advance carries no interest, whatever was typed.
    interestRate: kind === "advance" ? 0 : num(r.interestRate ?? 0),
    eligibleAfterMonths: num(r.eligibleAfterMonths ?? 0),
    selfService: r.selfService === true,
    isActive: r.isActive !== false,
  };
}

export function validateTypeForm(f: LoanTypeForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name) e.name = "Enter a name";
  const cap = MAX_INSTALLMENTS[f.kind];
  if (!Number.isInteger(f.maxInstallments) || f.maxInstallments < 1) e.maxInstallments = "Enter the most installments allowed";
  else if (f.maxInstallments > cap) e.maxInstallments = f.kind === "advance" ? "A salary advance is recovered within 12 months" : `At most ${cap} months`;
  if (!Number.isFinite(f.interestRate) || f.interestRate < 0 || f.interestRate > 100 || !twoDecimals(f.interestRate)) e.interestRate = "Between 0 and 100";
  if (!Number.isFinite(f.maxAmount) || f.maxAmount < 0 || !twoDecimals(f.maxAmount)) e.maxAmount = "0 or more (0: no fixed limit)";
  if (!Number.isFinite(f.maxSalaryMonths) || f.maxSalaryMonths < 0 || f.maxSalaryMonths > 60 || !twoDecimals(f.maxSalaryMonths)) e.maxSalaryMonths = "Between 0 and 60 (0: no such limit)";
  if (!Number.isInteger(f.eligibleAfterMonths) || f.eligibleAfterMonths < 0 || f.eligibleAfterMonths > 240) e.eligibleAfterMonths = "Whole months, 0 to 240";
  // Employees ask without anyone choosing an amount for them: a limit has to be there.
  if (f.selfService && !e.maxAmount && !e.maxSalaryMonths && !(f.maxAmount > 0) && !(f.maxSalaryMonths > 0)) {
    e.maxAmount = "Employees ask for this type themselves: set a limit (an amount, or months of salary)";
  }
  return e;
}

// ---- terms ----------------------------------------------------------------------------------

export interface LoanTerms {
  interest: string;
  totalPayable: string;
  /** Each month's deduction, rounded up to the paisa; the last one takes what is left. */
  installment: string;
  /** Deductions it takes. */
  months: number;
  lastInstallment: string;
}

/** Flat interest once on the amount, spread over the installments (rounded up, so nothing is left over). */
export function loanTerms(amount: Decimal.Value, ratePct: Decimal.Value, installments: number): LoanTerms {
  const principal = Decimal.max(0, dec(amount));
  const n = Math.max(1, Math.floor(Number(installments) || 1));
  const interest = principal.times(dec(ratePct)).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = principal.plus(interest);
  const installment = total.dividedBy(n).toDecimalPlaces(2, ROUND_UP);
  const months = installment.gt(0) ? total.dividedBy(installment).ceil().toNumber() : 0;
  const last = months > 0 ? total.minus(installment.times(months - 1)) : new Decimal(0);
  return { interest: interest.toFixed(2), totalPayable: total.toFixed(2), installment: installment.toFixed(2), months, lastInstallment: last.toFixed(2) };
}

// ---- recovery through payroll ---------------------------------------------------------------

/** A running loan as payroll reads it. */
export interface RunningLoan {
  id: string;
  installment: Decimal.Value;
  remaining: Decimal.Value;
  /** On payslips of runs not yet locked (other than the payslip being worked out). */
  reserved?: Decimal.Value;
  /** BS month (YYYY-MM) payroll deducts from; null for loans recorded before 4.10. */
  firstDeductionMonth: string | null;
  /** AD date it was given. */
  givenDate: string;
}

/** Payroll recovers a loan from its first deduction month (loans recorded before 4.10: from the month they were given). */
export function deductsIn(loan: Pick<RunningLoan, "firstDeductionMonth" | "givenDate">, run: { payMonth: string; periodEnd: string }): boolean {
  return loan.firstDeductionMonth && isPayMonth(loan.firstDeductionMonth) ? run.payMonth >= loan.firstDeductionMonth : String(loan.givenDate).slice(0, 10) <= run.periodEnd;
}

/** Less than this is never left on a loan for another month: the deduction before takes it. */
export const LEFTOVER_FLOOR = 1;

/** What one month deducts: the installment, or all that is left when less than Rs 1 would remain. */
export function monthlyDue(loan: Pick<RunningLoan, "installment" | "remaining" | "reserved">): Decimal {
  const available = Decimal.max(0, dec(loan.remaining).minus(dec(loan.reserved)));
  if (available.lte(0)) return new Decimal(0);
  const due = Decimal.min(Decimal.max(0, dec(loan.installment)), available);
  return available.minus(due).lt(LEFTOVER_FLOOR) ? available : due;
}

export interface LoanLine {
  loanId: string;
  /** "1234.50" */
  amount: string;
}

/** A payslip's loan lines for the month: each running loan's due, in the order given (oldest first). */
export function monthLines(loans: readonly RunningLoan[], run: { payMonth: string; periodEnd: string }): LoanLine[] {
  return loans
    .filter((l) => deductsIn(l, run))
    .map((l) => ({ loanId: l.id, amount: monthlyDue(l).toFixed(2) }))
    .filter((l) => Number(l.amount) > 0);
}

export const linesTotal = (lines: readonly { amount: Decimal.Value }[]): string => lines.reduce<Decimal>((s, l) => s.plus(dec(l.amount)), new Decimal(0)).toFixed(2);

/** Lines cut to what the pay can bear (net pay never below zero); the oldest loans keep theirs first. */
export function capLines(lines: readonly LoanLine[], cap: Decimal.Value): LoanLine[] {
  let left = Decimal.max(0, dec(cap));
  const out: LoanLine[] = [];
  for (const l of lines) {
    const take = Decimal.min(left, dec(l.amount));
    if (take.gt(0)) out.push({ loanId: l.loanId, amount: take.toFixed(2) });
    left = left.minus(take);
  }
  return out;
}

/**
 * A loan deduction typed on a payslip instead of the installments: spread over the employee's
 * running loans oldest first, each up to what it still owes. Zero skips the month.
 */
export function spreadDeduction(total: unknown, loans: readonly { loanId: string; available: Decimal.Value }[]): { lines: LoanLine[] } | { error: string } {
  const n = num(total);
  if (!Number.isFinite(n) || n < 0 || !twoDecimals(n)) return { error: "Enter the loan deduction (0 or more)" };
  const amount = new Decimal(n);
  const owed = loans.reduce<Decimal>((s, l) => s.plus(Decimal.max(0, dec(l.available))), new Decimal(0));
  if (amount.gt(owed)) return { error: owed.gt(0) ? `At most NPR ${npr(owed)}: what this employee's running loans still owe` : "This employee has no running loan to deduct" };
  let left = amount;
  const lines: LoanLine[] = [];
  for (const l of loans) {
    const take = Decimal.min(left, Decimal.max(0, dec(l.available)));
    if (take.gt(0)) lines.push({ loanId: l.loanId, amount: take.toFixed(2) });
    left = left.minus(take);
  }
  return { lines };
}

/** Deductions still to come for a balance. */
export function installmentsLeft(remaining: Decimal.Value, installment: Decimal.Value): number {
  let left = Decimal.max(0, dec(remaining));
  if (left.lte(0)) return 0;
  if (dec(installment).lte(0)) return 1;
  let n = 0;
  while (left.gt(0) && n < 1000) {
    left = left.minus(monthlyDue({ installment, remaining: left }));
    n += 1;
  }
  return n;
}

/** Share of the total payable that came back (0–100, one decimal); a written-off part never counts. */
export function repaidPct(totalPayable: Decimal.Value, returned: Decimal.Value): number {
  const total = dec(totalPayable);
  if (total.lte(0)) return 0;
  const pct = dec(returned).dividedBy(total).times(100).toDecimalPlaces(1).toNumber();
  return Math.min(100, Math.max(0, pct));
}

// ---- requests -------------------------------------------------------------------------------

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "withdrawn", "disbursed"] as const;
export type LoanRequestStatus = (typeof REQUEST_STATUSES)[number];
export const asRequestStatus = (v: unknown): LoanRequestStatus => ((REQUEST_STATUSES as readonly string[]).includes(v as string) ? (v as LoanRequestStatus) : "pending");

export const REASON_MIN = 5;

export interface RequestForm {
  employeeId: string;
  loanTypeId: string;
  amount: number;
  installments: number;
  reason: string;
}

export function normalizeRequestForm(raw: unknown): RequestForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { employeeId: text(r.employeeId, 64), loanTypeId: text(r.loanTypeId, 64), amount: num(r.amount), installments: num(r.installments), reason: text(r.reason, 500) };
}

export interface RequestTypeFacts {
  name: string;
  kind: LoanKind;
  isActive: boolean;
  selfService: boolean;
  maxAmount: number;
  maxSalaryMonths: number;
  maxInstallments: number;
  eligibleAfterMonths: number;
}

export interface RequestLimit {
  /** The most that may be asked for (null: no limit). */
  amount: number | null;
  /** Why it is that much ("the type's limit", "2 months of basic + grade"). */
  basis: string | null;
  /** The limit is months of salary but no salary structure is in force. */
  needsSalary: boolean;
}

/** The most this person may ask for: the type's fixed limit, months of basic + grade, or the smaller of both. */
export function requestLimit(type: Pick<RequestTypeFacts, "maxAmount" | "maxSalaryMonths">, monthlySalary: number | null): RequestLimit {
  const caps: { amount: number; basis: string }[] = [];
  if (type.maxAmount > 0) caps.push({ amount: type.maxAmount, basis: "the type's limit" });
  if (type.maxSalaryMonths > 0) {
    if (monthlySalary === null || !(monthlySalary > 0)) return { amount: null, basis: null, needsSalary: true };
    const months = Number.isInteger(type.maxSalaryMonths) ? String(type.maxSalaryMonths) : type.maxSalaryMonths.toFixed(1);
    caps.push({ amount: new Decimal(monthlySalary).times(type.maxSalaryMonths).toDecimalPlaces(2).toNumber(), basis: `${months} month${type.maxSalaryMonths === 1 ? "" : "s"} of basic + grade` });
  }
  if (!caps.length) return { amount: null, basis: null, needsSalary: false };
  const least = caps.reduce((a, b) => (b.amount < a.amount ? b : a));
  return { ...least, needsSalary: false };
}

export interface RequestFacts {
  type: RequestTypeFacts | null;
  /** Basic + grade in force a month (null: no salary structure). */
  monthlySalary: number | null;
  /** Completed months of service today (null: unknown). */
  serviceMonths: number | null;
  /** A loan of this type still being repaid, or a request for it still open. */
  openOfType: "loan" | "request" | null;
  /** The employee asks for themselves (self-service, or the office form about one's own record). */
  ownRequest: boolean;
  /** Active and within the user's scope. */
  employeeOk: boolean;
}

export function validateRequest(f: RequestForm, facts: RequestFacts): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.employeeId || !facts.employeeOk) e.employeeId = "Choose an active employee in your scope";
  const t = facts.type;
  if (!t) e.loanTypeId = "Choose the loan type";
  else if (!t.isActive) e.loanTypeId = `${t.name} is no longer offered`;
  else if (facts.ownRequest && !t.selfService) e.loanTypeId = `${t.name} is not asked for by employees themselves: HR requests it`;
  else if (facts.serviceMonths !== null && t.eligibleAfterMonths > 0 && facts.serviceMonths < t.eligibleAfterMonths) {
    e.loanTypeId = `Available after ${monthsText(t.eligibleAfterMonths)} of service (${monthsText(facts.serviceMonths)} so far)`;
  } else if (facts.openOfType === "loan") e.loanTypeId = `${t.name}: one is still being repaid (one at a time)`;
  else if (facts.openOfType === "request") e.loanTypeId = `${t.name}: a request is already open`;

  if (!Number.isFinite(f.amount) || f.amount <= 0) e.amount = "Enter the amount";
  else if (!twoDecimals(f.amount)) e.amount = "At most two decimals";
  else if (t) {
    const limit = requestLimit(t, facts.monthlySalary);
    if (limit.needsSalary) e.amount = "No salary structure in force: the limit (months of salary) can't be worked out";
    else if (limit.amount !== null && f.amount > limit.amount) e.amount = `At most NPR ${npr(limit.amount)} (${limit.basis})`;
  }
  if (!Number.isInteger(f.installments) || f.installments < 1) e.installments = "Whole months, at least 1";
  else if (t && t.maxInstallments > 0 && f.installments > t.maxInstallments) e.installments = `At most ${t.maxInstallments}`;
  if (f.reason.length < REASON_MIN) e.reason = `Say what it is for (at least ${REASON_MIN} characters)`;
  return e;
}

/** Completed months between two AD dates (YYYY-MM-DD). */
export function completedMonths(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = String(fromIso).slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = String(toIso).slice(0, 10).split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return 0;
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(0, months);
}

/** Monthly installments as a share of basic + grade (null when the salary is unknown). */
export function burdenPct(monthlyInstallments: Decimal.Value, monthlySalary: number | null): number | null {
  if (monthlySalary === null || !(monthlySalary > 0)) return null;
  return dec(monthlyInstallments).dividedBy(monthlySalary).times(100).toDecimalPlaces(0).toNumber();
}

// ---- approval -------------------------------------------------------------------------------

export const LOAN_WORDING: ApprovalWording = {
  ownSubject: "This is your own loan, so someone else has to approve it.",
  noPermission: "You can't approve loans (Loans → Approve).",
  preparer: "You asked for this loan, so someone else has to approve it.",
};

/** The flow kept on a request (simple unless levels were fixed on it). */
export function requestFlow(r: { approvalType: string | null; approvalLevels: unknown }): ApprovalFlow {
  const levels = Array.isArray(r.approvalLevels) ? (r.approvalLevels as FlowLevel[]) : [];
  return { type: r.approvalType === "multi_level" && levels.length ? "multi_level" : "simple", levels };
}

/** A request as the approval engine sees it (a disbursed request was approved). */
export function approvalRequestOf(r: { status: string; preparedBy: string | null; employeeId: string; approvalType: string | null; approvalLevels: unknown; currentLevel: number | null }): ApprovalRequest {
  const status = asRequestStatus(r.status);
  return { status: status === "disbursed" ? "approved" : status, preparedById: r.preparedBy, subjectEmployeeIds: [r.employeeId], flow: requestFlow(r), currentLevel: r.currentLevel ?? 0 };
}

/** Deciding loans: the maker-checker mode says whether an administrator may Final approve a request they made. */
export const loanDecisionCtx = (approvers: readonly ApproverInfo[], checker: CheckerMode, today: string): DecisionContext => ({
  approvers,
  today,
  wording: LOAN_WORDING,
  preparerMayFinalApprove: checker !== "strict",
});

export function validateDecisionNote(decision: "approve" | "reject" | "withdraw", note: string): string | null {
  return decision === "reject" && note.trim().length < 3 ? "Say why it is rejected" : null;
}

// ---- disbursement ---------------------------------------------------------------------------

export const PAID_VIA = ["bank", "cash", "cheque"] as const;
export type PaidVia = (typeof PAID_VIA)[number];
export const PAID_VIA_LABEL: Record<PaidVia, string> = { bank: "Bank transfer", cash: "Cash", cheque: "Cheque" };
const asPaidVia = (v: unknown): PaidVia | "" => ((PAID_VIA as readonly string[]).includes(v as string) ? (v as PaidVia) : "");

export interface DisburseForm {
  /** AD date it was paid out. */
  givenDate: string;
  /** BS month (YYYY-MM) payroll starts deducting. */
  firstDeductionMonth: string;
  paidVia: PaidVia | "";
  paymentRef: string;
  note: string;
}

export function normalizeDisburseForm(raw: unknown): DisburseForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { givenDate: text(r.givenDate, 10), firstDeductionMonth: text(r.firstDeductionMonth, 7), paidVia: asPaidVia(r.paidVia), paymentRef: text(r.paymentRef, 100), note: text(r.note, 500) };
}

export function validateDisburse(f: DisburseForm, ctx: { today: string; requestedOn: string; payMonths: readonly string[] }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!ISO_DATE.test(f.givenDate)) e.givenDate = "Enter the date it was paid out";
  else if (f.givenDate > ctx.today) e.givenDate = "Not a date in the future";
  else if (f.givenDate < ctx.requestedOn) e.givenDate = "Not before the request was made";
  if (!ctx.payMonths.includes(f.firstDeductionMonth)) e.firstDeductionMonth = "Choose the month payroll starts deducting";
  if (!f.paidVia) e.paidVia = "Choose how it was paid out";
  else if (f.paidVia !== "cash" && !f.paymentRef) e.paymentRef = f.paidVia === "cheque" ? "Enter the cheque number" : "Enter the transfer reference";
  return e;
}

// ---- repayment and closing ------------------------------------------------------------------

export interface RepaymentForm {
  /** AD date it was received. */
  date: string;
  amount: number;
  /** Receipt number or a note. */
  note: string;
}

export function normalizeRepaymentForm(raw: unknown): RepaymentForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { date: text(r.date, 10), amount: num(r.amount), note: text(r.note, 500) };
}

export function validateRepayment(f: RepaymentForm, ctx: { today: string; givenDate: string; remaining: number; reserved: number; reservedIn?: string | null }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!ISO_DATE.test(f.date)) e.date = "Enter the date it was received";
  else if (f.date > ctx.today) e.date = "Not a date in the future";
  else if (f.date < String(ctx.givenDate).slice(0, 10)) e.date = "Not before the loan was given";
  const open = Decimal.max(0, dec(ctx.remaining).minus(dec(ctx.reserved)));
  if (!Number.isFinite(f.amount) || f.amount <= 0) e.amount = "Enter the amount received";
  else if (!twoDecimals(f.amount)) e.amount = "At most two decimals";
  else if (new Decimal(f.amount).gt(open)) {
    e.amount = ctx.reserved > 0 ? `At most NPR ${npr(open)} now: NPR ${npr(ctx.reserved)} is on ${ctx.reservedIn ? `the ${ctx.reservedIn}` : "a"} payslip not yet locked` : `At most NPR ${npr(open)} (the balance)`;
  }
  return e;
}

export const WRITE_OFF_REASON_MIN = 10;

export function validateWriteOffReason(reason: unknown): string | null {
  return text(reason, 500).length >= WRITE_OFF_REASON_MIN ? null : `Say why it is written off (at least ${WRITE_OFF_REASON_MIN} characters; the decision's reference helps)`;
}

export const CLOSED_HOW = ["repaid", "settlement", "written_off"] as const;
export type ClosedHow = (typeof CLOSED_HOW)[number];
export const asClosedHow = (v: unknown): ClosedHow | null => ((CLOSED_HOW as readonly string[]).includes(v as string) ? (v as ClosedHow) : null);

// ---- opening balances (F15) -----------------------------------------------------------------

export const LOAN_OPENING_COLUMNS: readonly ImportColumn[] = [
  { key: "employeeCode", header: "Employee code", required: true, help: "As in Employees, e.g. EMP-001" },
  { key: "loanType", header: "Loan type", required: true, help: "The name of a loan type under Loans → Loan types" },
  { key: "givenDate", header: "Date given (BS)", required: true, help: "YYYY-MM-DD in BS, e.g. 2081-04-15" },
  { key: "amount", header: "Amount given", required: true, help: "What was lent, e.g. 1,50,000" },
  { key: "balance", header: "Balance to recover", required: true, help: "What is still to be recovered now, interest included" },
  { key: "installment", header: "Monthly installment", required: true, help: "What each pay run deducts from now on" },
  { key: "repaid", header: "Repaid before", help: "Optional: what came back in the old system (shown as progress); empty = amount given − balance" },
  { key: "note", header: "Note", help: "Optional, e.g. the old system's loan number" },
];

export interface OpeningLoan {
  /** AD date it was given. */
  givenDate: string;
  amount: string;
  balance: string;
  installment: string;
  repaid: string;
}

/** One row of the opening-balances file: the values, or what is wrong with them. */
export function readOpeningLoanRow(row: SheetRow, today: string): { employeeCode: string; typeName: string; loan: OpeningLoan | null; note: string; issues: RowIssue[] } {
  const c = row.cells;
  const issues: RowIssue[] = [];
  const err = (column: string, message: string) => issues.push({ column, message, level: "error" });
  const warn = (column: string, message: string) => issues.push({ column, message, level: "warning" });
  const employeeCode = (c.employeeCode ?? "").trim();
  const typeName = (c.loanType ?? "").trim();
  if (!employeeCode) err("Employee code", "Enter the employee code");
  if (!typeName) err("Loan type", "Enter the loan type");

  let givenDate = "";
  const date = readBsDate(c.givenDate ?? "");
  if ("error" in date) err("Date given (BS)", date.error);
  else if (date.ad > today) err("Date given (BS)", "Not a date in the future");
  else givenDate = date.ad;

  const amountOf = (key: string, header: string, required: boolean): number | null => {
    const raw = (c[key] ?? "").trim();
    if (!raw) {
      if (required) err(header, "Enter the amount");
      return null;
    }
    const v = readAmount(raw);
    if (v === null || v < 0) {
      err(header, `${raw} is not an amount`);
      return null;
    }
    return v;
  };
  const amount = amountOf("amount", "Amount given", true);
  const balance = amountOf("balance", "Balance to recover", true);
  const installment = amountOf("installment", "Monthly installment", true);
  const repaid = amountOf("repaid", "Repaid before", false);
  if (amount !== null && amount <= 0) err("Amount given", "More than 0");
  if (balance !== null && balance <= 0) err("Balance to recover", "More than 0 (a loan already repaid is not carried)");
  if (installment !== null && installment <= 0) err("Monthly installment", "More than 0");
  if (amount !== null && balance !== null && amount > 0 && balance > amount) warn("Balance to recover", "More than the amount given (interest?): check it");
  if (installment !== null && balance !== null && balance > 0 && installment > balance) warn("Monthly installment", "More than the balance: the next pay run recovers it all");

  const note = (c.note ?? "").trim().slice(0, 500);
  const ok = !issues.some((i) => i.level === "error") && amount !== null && balance !== null && installment !== null;
  return {
    employeeCode,
    typeName,
    note,
    issues,
    loan: ok
      ? {
          givenDate,
          amount: new Decimal(amount).toFixed(2),
          balance: new Decimal(balance).toFixed(2),
          installment: new Decimal(installment).toFixed(2),
          repaid: new Decimal(repaid ?? Math.max(0, amount - balance)).toFixed(2),
        }
      : null,
  };
}

/** What a carried loan is stored with: the total payable is what came back plus what is left. */
export function openingTerms(o: OpeningLoan): { totalPayable: string; interestRate: string; installmentsLeft: number } {
  const total = dec(o.repaid).plus(dec(o.balance));
  const amount = dec(o.amount);
  const rate = amount.gt(0) && total.gt(amount) ? Decimal.min(999.99, total.dividedBy(amount).minus(1).times(100).toDecimalPlaces(2)) : new Decimal(0);
  return { totalPayable: total.toFixed(2), interestRate: rate.toFixed(2), installmentsLeft: installmentsLeft(o.balance, o.installment) };
}
