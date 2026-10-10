import Decimal from "decimal.js";
import { payslipStatement, type HeadFigures, type HeadRole, type SlipFigures } from "@/lib/engines/payslip-view.engine";
import { balanceOn } from "@/lib/engines/leave.engine";
import { installmentsLeft } from "@/lib/engines/loan.engine";
import { localClock } from "@/lib/engines/attendance-day.engine";
import { shiftAllowanceDays } from "@/lib/engines/shift-allowance.engine";
import { asRunType, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { runLabel } from "@/lib/engines/pay-calendar.engine";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { DAY_CODE, type DayResult, type DayType, type MonthSummary } from "@/lib/types/attendance";
import type { LedgerKind } from "@/lib/types/leave";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type {
  AttendanceDayCell,
  AttendanceParams,
  AttendanceReportRow,
  BankTransferRow,
  LeaveMovementRow,
  LeaveReportParams,
  LoanReportParams,
  PayslipReportParams,
  ReportOption,
  SalaryLineColumn,
  SalaryLineRow,
  SalaryParams,
  SalarySheetRow,
} from "@/lib/types/report";
import { ATTENDANCE_VIEWS, LEAVE_REQUEST_STATUSES, LEAVE_VIEWS, LOAN_STATUS_FILTERS, LOAN_VIEWS, SALARY_GROUPS, SALARY_VIEWS } from "@/lib/types/report";

// Reports (4.11): the pure rules behind every report — which parameters are allowed, how a
// payslip becomes a salary-sheet row (the payslip's own statement, so the sheet and the payslip
// always agree), the pay-line summary, the bank list, attendance rows, the leave movement of a
// year and loan rows. No database access; tests/report.engine.test.ts.

const dec = (v: Decimal.Value | null | undefined) => {
  try {
    return new Decimal(v || 0);
  } catch {
    return new Decimal(0);
  }
};
const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
// + 0 turns -0 into 0 ("-0" would print).
const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** An account number with only its last 4 digits showing ("****2345"): printed payslips. */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber || !accountNumber.trim()) return "N/A";
  const clean = accountNumber.trim();
  if (clean.length <= 4) return clean;
  return "*".repeat(Math.min(clean.length - 4, 8)) + clean.slice(-4);
}

// ---------------------------------------------------------------------------
// Parameters: anything not offered falls back (ids outside the viewer's scope never pass)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const asRaw = (raw: unknown): Raw => (raw && typeof raw === "object" ? (raw as Raw) : {});
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const idIn = (value: unknown, options: readonly ReportOption[], fallback = ""): string => (typeof value === "string" && options.some((o) => o.value === value) ? value : fallback);

export interface PlaceChoices {
  branches: readonly ReportOption[];
  departments: readonly ReportOption[];
  employees: readonly ReportOption[];
}

function places(r: Raw, choices: PlaceChoices) {
  return { branchId: idIn(r.branchId, choices.branches), departmentId: idIn(r.departmentId, choices.departments), employeeId: idIn(r.employeeId, choices.employees) };
}

export function normalizeSalaryParams(raw: unknown, runs: readonly ReportOption[], choices: PlaceChoices): SalaryParams {
  const r = asRaw(raw);
  return {
    runId: idIn(r.runId, runs, runs[0]?.value ?? ""),
    view: oneOf(r.view, SALARY_VIEWS, "sheet"),
    groupBy: oneOf(r.groupBy, SALARY_GROUPS, "none"),
    ...places(r, choices),
  };
}

export function normalizePayslipParams(raw: unknown, runs: readonly ReportOption[], choices: PlaceChoices): PayslipReportParams {
  const r = asRaw(raw);
  return { runId: idIn(r.runId, runs, runs[0]?.value ?? ""), ...places(r, choices) };
}

export function normalizeAttendanceParams(raw: unknown, years: readonly ReportOption[], monthsOf: (fiscalYearId: string) => ReportOption[], defaults: { fiscalYearId: string; month: string }, choices: PlaceChoices): AttendanceParams {
  const r = asRaw(raw);
  const fiscalYearId = idIn(r.fiscalYearId, years, defaults.fiscalYearId);
  const months = monthsOf(fiscalYearId);
  const fallbackMonth = months.some((m) => m.value === defaults.month) ? defaults.month : (months[0]?.value ?? "");
  return { fiscalYearId, month: idIn(r.month, months, fallbackMonth), view: oneOf(r.view, ATTENDANCE_VIEWS, "summary"), ...places(r, choices) };
}

export function normalizeLeaveParams(raw: unknown, years: readonly ReportOption[], types: readonly ReportOption[], defaultYear: string, choices: PlaceChoices): LeaveReportParams {
  const r = asRaw(raw);
  return {
    fiscalYearId: idIn(r.fiscalYearId, years, defaultYear),
    view: oneOf(r.view, LEAVE_VIEWS, "balances"),
    leaveTypeId: idIn(r.leaveTypeId, types),
    status: oneOf(r.status, LEAVE_REQUEST_STATUSES, "all"),
    reasons: r.reasons === true,
    ...places(r, choices),
  };
}

export function normalizeLoanParams(raw: unknown, years: readonly ReportOption[], monthsOf: (fiscalYearId: string) => ReportOption[], defaultYear: string, types: readonly ReportOption[], choices: PlaceChoices): LoanReportParams {
  const r = asRaw(raw);
  const fiscalYearId = idIn(r.fiscalYearId, years, defaultYear);
  return {
    view: oneOf(r.view, LOAN_VIEWS, "loans"),
    status: oneOf(r.status, LOAN_STATUS_FILTERS, "running"),
    fiscalYearId,
    month: idIn(r.month, monthsOf(fiscalYearId)),
    loanTypeId: idIn(r.loanTypeId, types),
    ...places(r, choices),
  };
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

/** The BS months of a fiscal year in order (Shrawan first): value "YYYY-MM", label "Shrawan 2083". */
export function fiscalMonths(fy: { startDateBS: string; fromMonth: number; toMonth: number }): ReportOption[] {
  const startYear = Number(String(fy.startDateBS).slice(0, 4));
  if (!Number.isFinite(startYear) || startYear < 1900) return [];
  const out: ReportOption[] = [];
  let year = startYear;
  let month = fy.fromMonth >= 1 && fy.fromMonth <= 12 ? fy.fromMonth : 4;
  for (let i = 0; i < 12; i++) {
    out.push({ value: `${year}-${String(month).padStart(2, "0")}`, label: `${BS_MONTHS_EN[month] ?? month} ${year}` });
    if (month === fy.toMonth && i > 0) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export const monthLabel = (value: string) => {
  const [y, m] = value.split("-").map(Number);
  return y && m ? `${BS_MONTHS_EN[m] ?? m} ${y}` : value;
};

// ---------------------------------------------------------------------------
// Scope and runs
// ---------------------------------------------------------------------------

/** What part of the company the report covers, in words. */
export function scopeLabel(scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds" | "isImpersonation">, branchName: (id: string) => string | undefined, departmentName: (id: string) => string | undefined): string {
  if (scope.scopeType === "BRANCH") return scope.branchIds.map(branchName).filter(Boolean).join(", ") || "No branch assigned";
  if (scope.scopeType === "DEPARTMENT") return scope.departmentIds.map(departmentName).filter(Boolean).join(", ") || "No department assigned";
  if (scope.scopeType === "SELF") return "Own record";
  return scope.isImpersonation ? "All branches (support view)" : "All branches";
}

export interface RunFacts {
  id: string;
  /** 4.8b: the pay calendar of the run's month; BS when absent. */
  calendar?: string;
  payPeriodYear: number;
  payPeriodMonth: number;
  runType: string;
  status: string;
  branchIds: string[];
}

/** "Aswin 2083 · Festival allowance · Lekhnath — locked". */
/** The run's month in its own calendar ("Aswin 2083", "October 2026"). */
export const runMonth = (run: Pick<RunFacts, "calendar" | "payPeriodYear" | "payPeriodMonth">): string => runLabel({ calendar: run.calendar ?? "BS", payPeriodYear: run.payPeriodYear, payPeriodMonth: run.payPeriodMonth });

export function runOptionLabel(run: RunFacts, allBranchIds: readonly string[], branchName: (id: string) => string | undefined): string {
  const parts = [runMonth(run), RUN_TYPE_LABEL[asRunType(run.runType)].en];
  const branches = runBranches(run, allBranchIds, branchName);
  if (branches) parts.push(branches);
  return `${parts.join(" · ")} — ${run.status === "LOCKED" ? "locked" : "approved, not locked"}`;
}

/** The run's branches in words, or "" when it covers every branch. */
export function runBranches(run: Pick<RunFacts, "branchIds">, allBranchIds: readonly string[], branchName: (id: string) => string | undefined): string {
  const ids = run.branchIds ?? [];
  if (!ids.length || allBranchIds.every((b) => ids.includes(b))) return "";
  return ids.map(branchName).filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Salary sheet
// ---------------------------------------------------------------------------

export interface SlipItem {
  slipId: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  bankName: string;
  bankAccount: string;
  figures: SlipFigures;
  heads: HeadFigures[];
}

type LineRank = { side: "earning" | "deduction"; rank: number };

/** Where a line sits: earnings basic → grade → allowances → SSF employer → OT → absence; deductions SSF → PF → CIT → others → loan → TDS. */
function rankOf(key: string, side: "earning" | "deduction", role: HeadRole | undefined): number {
  if (side === "earning") {
    if (key === "basic") return 0;
    if (key === "grade") return 1;
    if (key === "ot") return 4;
    if (key === "absence") return 5;
    return role === "ssfEmployer" ? 3 : 2;
  }
  if (key === "loan") return 4;
  return role === "ssf" ? 0 : role === "pf" ? 1 : role === "cit" ? 2 : role === "tds" ? 5 : 3;
}

interface BuiltSlip {
  item: SlipItem;
  statement: ReturnType<typeof payslipStatement>;
  roles: Map<string, HeadRole>;
}

function build(items: readonly SlipItem[]): BuiltSlip[] {
  return items.map((item) => ({
    item,
    statement: payslipStatement(item.figures, item.heads),
    roles: new Map(item.heads.map((h) => [`head:${h.payHeadId}`, h.role])),
  }));
}

/** The pay lines that appear on any payslip of the run, as columns in payslip order. */
export function salaryColumns(items: readonly SlipItem[]): SalaryLineColumn[] {
  const seen = new Map<string, SalaryLineColumn & LineRank>();
  for (const { statement, roles } of build(items)) {
    for (const [side, lines] of [["earning", statement.earnings], ["deduction", statement.deductions]] as const) {
      for (const line of lines) {
        if (seen.has(line.key)) continue;
        seen.set(line.key, { key: line.key, label: line.label.en, labelNp: line.label.np && line.label.np !== line.label.en ? line.label.np : null, side, rank: rankOf(line.key, side, roles.get(line.key)) });
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => (a.side === b.side ? 0 : a.side === "earning" ? -1 : 1) || a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ key, label, labelNp, side }) => ({ key, label, labelNp, side }));
}

/** One row per payslip: every line's amount and the summary groups. */
export function salaryRows(items: readonly SlipItem[]): SalarySheetRow[] {
  return build(items).map(({ item, statement, roles }) => {
    const lines: Record<string, string> = {};
    for (const l of [...statement.earnings, ...statement.deductions]) lines[l.key] = l.amount;
    const sumWhere = (keys: (key: string, role: HeadRole | undefined) => boolean) =>
      statement.deductions.filter((l) => keys(l.key, roles.get(l.key))).reduce((s, l) => s.plus(l.amount), new Decimal(0));
    const basicGrade = dec(lines.basic).plus(dec(lines.grade));
    const retirement = sumWhere((_, role) => role === "ssf" || role === "pf" || role === "cit");
    const tax = sumWhere((_, role) => role === "tds");
    const loan = dec(lines.loan);
    const total = dec(statement.totalDeductions);
    return {
      slipId: item.slipId,
      code: item.code,
      name: item.name,
      designation: item.designation,
      department: item.department,
      branch: item.branch,
      lines,
      gross: statement.gross,
      totalDeductions: statement.totalDeductions,
      net: statement.net,
      basicGrade: money(basicGrade),
      allowances: money(dec(statement.gross).minus(basicGrade)),
      retirement: money(retirement),
      tax: money(tax),
      loan: money(loan),
      otherDeductions: money(total.minus(retirement).minus(tax).minus(loan)),
      adjusted: [...statement.earnings, ...statement.deductions].some((l) => l.adjusted),
      balanced: statement.balanced,
    };
  });
}

/** Every pay line across the run: people paid it, total, average, lines typed by a reviewer. */
export function salaryLines(items: readonly SlipItem[]): SalaryLineRow[] {
  const columns = salaryColumns(items);
  const built = build(items);
  return columns.map((c) => {
    let total = new Decimal(0);
    let employees = 0;
    let adjusted = 0;
    for (const { statement } of built) {
      const line = [...statement.earnings, ...statement.deductions].find((l) => l.key === c.key);
      if (!line || dec(line.amount).isZero()) continue;
      employees += 1;
      total = total.plus(line.amount);
      if (line.adjusted) adjusted += 1;
    }
    return { key: c.key, label: c.label, labelNp: c.labelNp, side: c.side, employees, total: money(total), average: money(employees ? total.div(employees) : new Decimal(0)), adjusted };
  });
}

const NO_ACCOUNT = /^(n\/?a|none|-+|0+)?$/i;

/** The bank list: net pay to each account, by bank; people without an account are listed as "Cash". */
export function bankRows(items: readonly SlipItem[]): BankTransferRow[] {
  return build(items).map(({ item, statement }) => {
    const account = (item.bankAccount ?? "").trim();
    const bank = (item.bankName ?? "").trim();
    const noAccount = NO_ACCOUNT.test(account);
    return { slipId: item.slipId, code: item.code, name: item.name, bank: noAccount ? "" : NO_ACCOUNT.test(bank) ? "Bank not recorded" : bank, account: noAccount ? "" : account, net: statement.net };
  });
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

const minutesText = (minutes: number) => (minutes > 0 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}` : null);

/** A day of the attendance card: the register code, times (Nepal clock) and what explains it. */
export function attendanceDay(d: DayResult, day: number): AttendanceDayCell {
  const type = d.dayType as DayType;
  const upcoming = type === "upcoming";
  const notes = [
    d.holidayName,
    d.leaveName,
    d.flags.includes("late") ? `late ${d.lateMinutes} min` : null,
    d.flags.includes("early") ? `left ${d.earlyMinutes} min early` : null,
    d.flags.includes("missing_punch") ? "punch missing" : null,
    d.otWorkDayMinutes + d.otOffDayMinutes > 0 ? `OT ${minutesText(d.otWorkDayMinutes + d.otOffDayMinutes)}` : null,
    d.flags.includes("override") ? "set by HR" : null,
  ].filter(Boolean);
  return {
    day,
    code: DAY_CODE[type]?.code ?? "",
    type: DAY_CODE[type]?.name ?? type,
    in: upcoming ? null : localClock(d.firstIn) || null,
    out: upcoming ? null : localClock(d.lastOut) || null,
    worked: upcoming ? null : minutesText(d.workMinutes),
    note: notes.length ? notes.join(" · ") : null,
  };
}

export interface AttendancePerson {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department: string;
  branch: string;
  days: DayResult[];
  summary: MonthSummary;
  amounts: { otEarnedAmount: string; leaveDeductionAmount: string; shiftAllowanceAmount: string };
}

/** One person's month as a report row; the pay effect only when the viewer may see pay. */
export function attendanceRow(p: AttendancePerson, showAmounts: boolean): AttendanceReportRow {
  const s = p.summary;
  const worked = p.days.filter((d) => d.dayType !== "upcoming").reduce((n, d) => n + d.workMinutes, 0);
  return {
    employeeId: p.id,
    code: p.employeeCode,
    name: p.fullName,
    designation: p.designation,
    department: p.department,
    branch: p.branch,
    employedDays: s.calendarDays - s.notEmployedDays,
    payableDays: round2(s.payableDays),
    present: s.presentDays,
    halfDays: s.halfDays,
    onDuty: s.onDutyDays,
    paidLeave: round2(s.paidLeaveDays),
    unpaidLeave: round2(s.unpaidLeaveDays),
    absent: s.absentDays,
    missingPunch: s.missingPunchDays,
    holidays: s.holidayDays,
    weeklyOff: s.weeklyOffDays,
    lateDays: s.lateDays,
    otWorkDayHours: round2(s.otWorkDayMinutes / 60),
    otOffDayHours: round2(s.otOffDayMinutes / 60),
    workedHours: round2(worked / 60),
    shiftDays: shiftAllowanceDays(s.shiftAllowance),
    otPay: showAmounts ? money(dec(p.amounts.otEarnedAmount)) : null,
    absenceDeduction: showAmounts ? money(dec(p.amounts.leaveDeductionAmount)) : null,
    shiftAllowance: showAmounts ? money(dec(p.amounts.shiftAllowanceAmount)) : null,
    days: p.days.map((d, i) => attendanceDay(d, i + 1)),
  };
}

// ---------------------------------------------------------------------------
// Leave: a year's movement for one person and type, from the ledger
// ---------------------------------------------------------------------------

export interface MovementLine {
  kind: LedgerKind;
  days: number;
  entryDate: string;
  expiresOn: string | null;
  createdAt?: string;
  id?: string;
}

/**
 * The year's lines for one person and leave type as columns:
 * brought forward + earned − taken + adjusted − paid out − lapsed / expired = available.
 * Available is the leave screens' own figure (balanceOn: every line of the year, substitute
 * grants expiring by the date); a written-off expiry line only mirrors that expiry, so it is
 * not counted twice.
 */
export function leaveMovement(lines: readonly MovementLine[], asOf: string): Omit<LeaveMovementRow, "key" | "code" | "name" | "leaveType"> {
  const sum = (kinds: LedgerKind[]) => lines.filter((l) => kinds.includes(l.kind)).reduce((n, l) => n + l.days, 0);
  const balance = balanceOn(lines, asOf);
  const expiredByRule = balance.expired.reduce((n, e) => n + e.days, 0);
  return {
    broughtForward: round2(sum(["opening", "carried_forward"])),
    earned: round2(sum(["credit", "accrual", "grant"])),
    taken: round2(-sum(["taken", "returned"])),
    adjusted: round2(sum(["adjusted", "not_granted"])),
    paidOut: round2(-sum(["paid_out"])),
    expired: round2(-sum(["lapsed"]) + expiredByRule),
    available: balance.available,
  };
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

const CLOSED_HOW_LABEL: Record<string, string> = { repaid: "Repaid", settlement: "Final settlement", written_off: "Written off" };

export function loanStatusLabel(loan: { status: string; closedHow: string | null }): string {
  if (loan.status === "ACTIVE") return "Running";
  return CLOSED_HOW_LABEL[loan.closedHow ?? ""] ?? "Closed";
}

export function loanInterest(loan: { loanAmount: Decimal.Value; totalPayable: Decimal.Value }): string {
  return money(Decimal.max(0, dec(loan.totalPayable).minus(dec(loan.loanAmount))));
}

export function loanInstallmentsLeft(loan: { status: string; remainingAmount: Decimal.Value; installmentAmount: Decimal.Value }): number | null {
  return loan.status === "ACTIVE" ? installmentsLeft(loan.remainingAmount, loan.installmentAmount) : null;
}

const PAID_VIA_LABEL: Record<string, string> = { bank: "Bank transfer", cash: "Cash", cheque: "Cheque" };
export const paidViaLabel = (v: string | null) => (v ? (PAID_VIA_LABEL[v] ?? v) : "");

/** How a repayment came in, in words. */
export function repaymentHow(method: string, run: { month: number; year: number } | null): string {
  if (method === "SALARY_DEDUCTION") return run ? `Payroll, ${BS_MONTHS_EN[run.month] ?? run.month} ${run.year}` : "Payroll";
  if (method === "SETTLEMENT") return "Final settlement";
  if (method === "CASH") return "Paid in";
  return method;
}
