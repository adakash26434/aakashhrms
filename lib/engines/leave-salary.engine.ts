import Decimal from "decimal.js";

// Leave salary (4.9): pure rules. Leave paid out in money comes from two places —
//   * the days over the limit when a leave year opens (Labour Act §49): the opening already took
//     them off the balance (`paid_out`, ref opening:<year>), so a record only pays them;
//   * days encashed from the balance in force (a type that allows it): they leave the balance
//     when the record is approved and come back if it is cancelled.
// A record is prepared, approved by someone else (never for one's own record, S21) and paid on
// the next regular pay run (LEAVE_ENCASH, taxable). Leaving employees are paid in the final
// settlement instead (F8). Nothing here touches the database.

/**
 * A day of leave in money. Statutory leave is basic per day (§49); a company type's fixed amount
 * is never paid below basic per day. Grade is not part of "basic remuneration" for encashment.
 */
export function calculateLeaveSalary(args: {
  basicSalary: string;
  leaveDays: number;
  workingDays?: number;
  encashmentRate?: 'BASIC_DAILY' | 'FIXED_AMOUNT';
  fixedDailyAmount?: number;
}): {
  perDayRate: string;
  totalAmount: string;
} {
  const days = new Decimal(args.leaveDays);
  const workDays = new Decimal(args.workingDays ?? 30);

  let dailyRate: Decimal;

  if (args.encashmentRate === 'FIXED_AMOUNT' && args.fixedDailyAmount) {
    dailyRate = Decimal.max(new Decimal(args.fixedDailyAmount), new Decimal(args.basicSalary).dividedBy(workDays));
  } else {
    // Default: BASIC_DAILY — Nepal Labour Act standard
    dailyRate = new Decimal(args.basicSalary).dividedBy(workDays);
  }

  const total = dailyRate.times(days).toDecimalPlaces(2);

  return {
    perDayRate: dailyRate.toDecimalPlaces(2).toString(),
    totalAmount: total.toString(),
  };
}

// ---- statuses ---------------------------------------------------------------------------

export const LEAVE_SALARY_STATUSES = ["DRAFT", "APPROVED", "PAID", "CANCELLED"] as const;
export type LeaveSalaryStatus = (typeof LEAVE_SALARY_STATUSES)[number];
export const asLeaveSalaryStatus = (v: unknown): LeaveSalaryStatus => (LEAVE_SALARY_STATUSES.includes(v as LeaveSalaryStatus) ? (v as LeaveSalaryStatus) : "DRAFT");

/** Who moves a record where: prepared → approved (someone else) → paid by a pay run; approved → cancelled before it is paid. */
const MOVES: Readonly<Record<LeaveSalaryStatus, readonly LeaveSalaryStatus[]>> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};
export const canMove = (from: LeaveSalaryStatus, to: LeaveSalaryStatus) => MOVES[from].includes(to);

export const SOURCES = ["year_end", "balance"] as const;
export type LeaveSalarySource = (typeof SOURCES)[number];

// ---- the pay month ----------------------------------------------------------------------
// A record is paid with this BS month's pay run or one of the next two (a later run also pays it);
// the helpers are shared with loans (lib/utils/pay-month.ts).

export { isPayMonth, payMonthLabel, payMonthOf, payMonthOptions } from "@/lib/utils/pay-month";

// ---- the form ---------------------------------------------------------------------------

export interface LeaveSalaryForm {
  employeeId: string;
  leaveTypeId: string;
  days: number;
  payMonth: string;
  note: string;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NaN;
};

export function normalizeForm(raw: unknown): LeaveSalaryForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { employeeId: text(r.employeeId, 64), leaveTypeId: text(r.leaveTypeId, 64), days: num(r.days), payMonth: text(r.payMonth, 7), note: text(r.note, 500) };
}

/** A type whose balance may be encashed while in service: a balance type the company pays out, never a right (§51) or substitute leave. */
export function encashableFromBalance(t: { kind: string; isEncashable: boolean; isRight: boolean; isActive: boolean; statutoryCode: string | null }): boolean {
  return t.kind === "balance" && t.isEncashable && !t.isRight && t.isActive && t.statutoryCode !== "SUBSTITUTE";
}

export interface FormContext {
  /** The leave type as the rules read it, or null when it does not exist. */
  type: { kind: string; isEncashable: boolean; isRight: boolean; isActive: boolean; statutoryCode: string | null; name: string } | null;
  /** Days usable today (the balance in force), or null when unknown. */
  available: number | null;
  payMonths: readonly string[];
}

/** Checks an encashment from the balance. Year-end records take their days from the opening line. */
export function validateForm(f: LeaveSalaryForm, ctx: FormContext): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.employeeId) errors.employeeId = "Choose the employee";
  if (!ctx.type) errors.leaveTypeId = "Choose the leave";
  else if (!encashableFromBalance(ctx.type)) {
    errors.leaveTypeId = ctx.type.isRight
      ? `${ctx.type.name} is a right (Labour Act §51): it is paid out only over its limit at the year end and when someone leaves`
      : `${ctx.type.name} is not paid out in money`;
  }
  if (!Number.isFinite(f.days) || f.days <= 0) errors.days = "Enter the days";
  else if (Math.round(f.days * 2) !== f.days * 2) errors.days = "Whole or half days only";
  else if (ctx.available !== null && f.days > ctx.available) errors.days = ctx.available > 0 ? `Only ${fmtDays(ctx.available)} available` : "Nothing available to encash";
  if (!ctx.payMonths.includes(f.payMonth)) errors.payMonth = "Choose the pay month";
  return errors;
}

export function validateCancelReason(reason: unknown): string | null {
  return text(reason, 500).length >= 5 ? null : "Say why it is cancelled (at least 5 characters)";
}

export const fmtDays = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;

/** Days a year-end line pays (the opening posted them negative). */
export const dueDays = (lineDays: number) => Math.round(Math.abs(lineDays) * 100) / 100;

/** Paisa-exact sum of record amounts (the pay run's LEAVE_ENCASH line). */
export function sumAmounts(amounts: readonly (string | number)[]): string {
  return amounts.reduce<Decimal>((sum, a) => sum.plus(new Decimal(a || 0)), new Decimal(0)).toFixed(2);
}
