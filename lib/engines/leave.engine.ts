// Leave rules (4.6). One engine decides how many days a request takes, how
// they are paid, and whether it may be made; the ledger sums balances.
// Labour Act 2074, Chapter 9: home leave 1 day per 20 days worked (up to
// 90), sick 12 a year (up to 45; certificate after 3 days in a row),
// maternity 98 days of which 60 paid (+1 unpaid month on a doctor's
// advice), maternity care 15, mourning 13 (calendar days), substitute leave
// within 21 days; sick, mourning and maternity are rights (§51), other
// leave may be refused or moved for a stated work reason.
// Pure: no database access.

import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import type { DayBasis, LeaveDayDetail, LeaveHalf, LeaveKind, LeavePay, LeaveRuleType, LeaveStatus, LedgerKind } from "@/lib/types/leave";

/** Maternity can be extended by an unpaid month on a doctor's advice (§45(4)). */
export const MATERNITY_EXTENSION_DAYS = 30;
/** The Labour Act's floor for statutory types (4.6c lets companies go higher, never lower). */
export const STATUTORY_FLOOR: Record<string, { days?: number; paidDays?: number; cap?: number; accrualEveryDays?: number; certificateAfter?: number }> = {
  HOME: { cap: 90, accrualEveryDays: 20 },
  SICK: { days: 12, cap: 45, certificateAfter: 3 },
  MATERNITY: { days: 98, paidDays: 60 },
  PATERNITY: { days: 15 },
  MOURNING: { days: 13 },
  SUBSTITUTE: {},
};

/**
 * Settings that would give less than the Labour Act (empty = within the law).
 * A company may only go higher (4.6c); a platform exception can relax one
 * setting for a regulated company.
 */
export function statutoryFloorProblems(
  statutoryCode: string | null,
  value: { days?: number | null; paidDays?: number | null; cap?: number | null; accrualEveryDays?: number | null; certificateAfter?: number | null }
): string[] {
  const floor = statutoryCode ? STATUTORY_FLOOR[statutoryCode] : undefined;
  if (!floor) return [];
  const out: string[] = [];
  const below = (v: number | null | undefined, min: number | undefined) => min !== undefined && v !== undefined && v !== null && v < min;
  if (below(value.days, floor.days)) out.push(`At least ${floor.days} days (Labour Act)`);
  if (below(value.paidDays, floor.paidDays)) out.push(`At least ${floor.paidDays} paid days (Labour Act §45)`);
  if (below(value.cap, floor.cap)) out.push(`Accumulation of at least ${floor.cap} days (Labour Act §49)`);
  // Home leave: 1 day per N days worked; a larger N gives less leave.
  if (floor.accrualEveryDays !== undefined && value.accrualEveryDays != null && value.accrualEveryDays > floor.accrualEveryDays) out.push(`At least 1 day per ${floor.accrualEveryDays} days worked (Labour Act §43)`);
  // A certificate asked for sooner than the law allows is stricter than the law.
  if (below(value.certificateAfter, floor.certificateAfter)) out.push(`A certificate can be asked for only after ${floor.certificateAfter} days in a row (Labour Act §44)`);
  return out;
}

/** How a statutory code behaves when the type does not say (also the migration defaults). */
export function defaultsFor(statutoryCode: string | null, pay: LeavePay): { kind: LeaveKind; dayBasis: DayBasis; paidDaysPerEvent: number | null; isRight: boolean } {
  switch (statutoryCode) {
    case "HOME":
    case "SUBSTITUTE":
      return { kind: "balance", dayBasis: "working", paidDaysPerEvent: null, isRight: false };
    case "SICK":
      return { kind: "balance", dayBasis: "working", paidDaysPerEvent: null, isRight: true };
    case "MATERNITY":
      return { kind: "event", dayBasis: "calendar", paidDaysPerEvent: 60, isRight: true };
    case "PATERNITY":
    case "MOURNING":
      return { kind: "event", dayBasis: "calendar", paidDaysPerEvent: null, isRight: true };
    default:
      return { kind: pay === "none" ? "none" : "balance", dayBasis: "working", paidDaysPerEvent: null, isRight: false };
  }
}

export const payOf = (leaveType: string): LeavePay => (leaveType === "Non-Pay" ? "none" : leaveType === "Partial-Pay" ? "half" : "full");

// ---------------------------------------------------------------------------
// Counting days
// ---------------------------------------------------------------------------

/** A day of the employee's calendar: off when it is their weekly off or a holiday for them. */
export interface CalendarDay {
  date: string;
  off: boolean;
  why?: string;
}

/**
 * The days a request takes. Working basis: weekly offs and holidays are not
 * counted (they say why). Calendar basis: every day counts. A half day is
 * one date only.
 */
export function countDays(calendar: readonly CalendarDay[], basis: DayBasis, half: LeaveHalf | null): { counted: { date: string; part: number }[]; skipped: { date: string; why: string }[]; days: number } {
  const counted: { date: string; part: number }[] = [];
  const skipped: { date: string; why: string }[] = [];
  for (const d of calendar) {
    if (basis === "working" && d.off) skipped.push({ date: d.date, why: d.why ?? "Day off" });
    else counted.push({ date: d.date, part: half ? 0.5 : 1 });
  }
  return { counted, skipped, days: counted.reduce((n, c) => n + c.part, 0) };
}

/**
 * How each counted day is paid: Pay types paid, Non-Pay unpaid; event
 * leave with paid days (maternity 60) pays the first N counted days and the
 * rest unpaid; other Partial-Pay types pay half of each day.
 */
export function splitPaid(counted: readonly { date: string; part: number }[], type: Pick<LeaveRuleType, "pay" | "paidDaysPerEvent">): { detail: LeaveDayDetail[]; paidDays: number; unpaidDays: number } {
  let paidSoFar = 0;
  const detail: LeaveDayDetail[] = counted.map((c) => {
    let pay: LeavePay;
    if (type.paidDaysPerEvent !== null && type.paidDaysPerEvent !== undefined) {
      pay = paidSoFar + c.part <= type.paidDaysPerEvent ? "full" : "none";
      if (pay === "full") paidSoFar += c.part;
    } else pay = type.pay;
    return { date: c.date, part: c.part, pay };
  });
  const paidDays = detail.reduce((n, d) => n + (d.pay === "full" ? d.part : d.pay === "half" ? d.part / 2 : 0), 0);
  const total = detail.reduce((n, d) => n + d.part, 0);
  return { detail, paidDays: round(paidDays), unpaidDays: round(total - paidDays) };
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// May it be requested?
// ---------------------------------------------------------------------------

export interface RequestCheck {
  type: LeaveRuleType;
  person: { gender: string; departmentId: string; designationId: string; joiningDate: string; terminationDate: string | null };
  from: string;
  to: string;
  half: LeaveHalf | null;
  days: number;
  /** The leave year the request starts in. */
  leaveYear: { start: string; end: string } | null;
  /** Other waiting / approved requests of the person over these dates (halves on the same day can both stand). */
  overlaps: number;
  /** Days already set by HR as leave (or anything) in the register. */
  hrDays: number;
  /** A closed attendance month for the person's branch inside the dates. */
  closed: boolean;
  /** Balance kinds: balance minus other waiting requests. */
  available: number | null;
  certificateNote: string;
}

/** Why a request can't be made (empty = it can), and notes that don't block. */
export function checkRequest(c: RequestCheck): { problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  const t = c.type;
  if (!t.isActive) problems.push(`${t.name} is not in use.`);
  if (t.genderApplicable !== "All" && t.genderApplicable !== c.person.gender) problems.push(`${t.name} is for ${t.genderApplicable.toLowerCase()} employees.`);
  if (!t.isStatutory && t.applicableDepartments.length && !t.applicableDepartments.includes(c.person.departmentId)) problems.push(`${t.name} is not for this department.`);
  if (!t.isStatutory && t.applicableDesignations.length && !t.applicableDesignations.includes(c.person.designationId)) problems.push(`${t.name} is not for this designation.`);
  if (c.to < c.from) problems.push("The last day is before the first.");
  if (c.half && c.from !== c.to) problems.push("A half day is one date only.");
  if (c.half && !t.allowHalfDay) problems.push(`${t.name} can't be taken as a half day.`);
  if (c.from < c.person.joiningDate) problems.push("These dates are before the joining date.");
  if (c.person.terminationDate && c.to > c.person.terminationDate) problems.push("These dates are after the last working day.");
  if (c.leaveYear && (c.from < c.leaveYear.start || c.to > c.leaveYear.end)) problems.push("A request can't cross into another leave year: split it at the year end.");
  if (c.to >= c.from && c.days === 0) problems.push("These dates are all weekly offs or holidays: there is nothing to take.");
  const maternity = t.statutoryCode === "MATERNITY";
  const limit = t.kind === "event" ? t.days + (maternity && c.certificateNote.trim() ? MATERNITY_EXTENSION_DAYS : 0) : t.maxDaysPerRequest;
  if (limit && c.days > limit) {
    problems.push(
      maternity
        ? `Maternity leave is ${t.days} days (${t.days + MATERNITY_EXTENSION_DAYS} with a doctor's note for the extra unpaid month).`
        : t.kind === "event"
          ? `${t.name} is ${t.days} days.`
          : `${t.name} is at most ${limit} days per request.`
    );
  }
  if (c.overlaps) problems.push("These dates overlap another leave request.");
  if (c.hrDays) problems.push("HR has already set some of these days in the register. Ask HR to clear them first.");
  if (c.closed) problems.push("These dates are in a closed attendance month. Ask HR to reopen it first.");
  if (t.kind === "balance" && c.available !== null && c.days > c.available) problems.push(`Not enough ${t.name.toLowerCase()}: ${fmt(c.available)} day${c.available === 1 ? "" : "s"} available.`);
  if (t.requiresDocument && t.documentThresholdDays !== null && c.days > t.documentThresholdDays) notes.push(`A certificate is needed for more than ${t.documentThresholdDays} days in a row.`);
  if (t.isRight) notes.push(`${t.name} is a right (Labour Act §51): it can be refused only when its conditions are not met.`);
  return { problems, notes };
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/** Lines that add to a balance and lines that take from it (signed days do the sums). */
export const LEDGER_SIGN: Record<LedgerKind, 1 | -1 | 0> = {
  opening: 1,
  credit: 1,
  accrual: 1,
  grant: 1,
  carried_forward: 1,
  returned: 1,
  adjusted: 0,
  taken: -1,
  paid_out: -1,
  expired: -1,
  lapsed: -1,
};

/** Balance = the sum of the lines (signed). */
export function ledgerBalance(lines: readonly { days: number }[]): number {
  return round(lines.reduce((n, l) => n + l.days, 0));
}

/** The summary row kept for older readers (allotted, taken, carried forward, balance). */
export function ledgerSummary(lines: readonly { kind: LedgerKind; days: number }[]) {
  const sum = (kinds: LedgerKind[]) => round(lines.filter((l) => kinds.includes(l.kind)).reduce((n, l) => n + l.days, 0));
  const carriedForward = sum(["carried_forward"]);
  const taken = round(-sum(["taken", "returned"]));
  const balance = ledgerBalance(lines);
  return { allotted: sum(["opening", "credit", "accrual", "grant", "adjusted"]), taken, carriedForward, balance };
}

/** A signed ledger amount: taken / paid out / expired / lapsed are negative. */
export function signed(kind: LedgerKind, days: number): number {
  const s = LEDGER_SIGN[kind];
  return s === 0 ? days : s * Math.abs(days);
}

// ---------------------------------------------------------------------------
// Statuses, scope and remarks (S17, shared with the employee record)
// ---------------------------------------------------------------------------

export const LEAVE_STATUSES: readonly LeaveStatus[] = ["Pending", "Approved", "Rejected", "Cancelled"];

export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return typeof value === "string" && (LEAVE_STATUSES as readonly string[]).includes(value);
}

/** Which status changes are possible: a waiting request is approved, rejected or withdrawn; an approved one can only be cancelled. */
const ALLOWED_TRANSITIONS: Record<LeaveStatus, readonly LeaveStatus[]> = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Cancelled"],
  Rejected: [],
  Cancelled: [],
};

export function canTransitionLeave(from: LeaveStatus, to: LeaveStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface ScopedEmployee {
  id: string;
  branchId: string | null;
  departmentId: string | null;
}

/**
 * In-memory twin of `buildEmployeeScopeCondition`: is this employee inside the
 * reviewer's branch / department / self scope? Fails closed for unknown scopes
 * and for BRANCH / DEPARTMENT scopes with nothing assigned.
 */
export function employeeInScope(scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds" | "employeeId">, employee: ScopedEmployee): boolean {
  switch (scope.scopeType) {
    case "GLOBAL":
      return true;
    case "BRANCH":
      return !!employee.branchId && scope.branchIds.includes(employee.branchId);
    case "DEPARTMENT":
      return !!employee.departmentId && scope.departmentIds.includes(employee.departmentId);
    case "SELF":
      return !!scope.employeeId && scope.employeeId === employee.id;
    default:
      return false;
  }
}

/** A reviewer may not approve or reject their own request (maker-checker, S21). */
export function isOwnRequest(reviewerEmployeeId: string | null | undefined, applicantEmployeeId: string): boolean {
  return isOwnRecord(reviewerEmployeeId, applicantEmployeeId);
}

export const REJECTION_REASON_MIN = 3;
export const REMARKS_MAX = 500;

/** Trims remarks and caps their length; returns null when empty. */
export function cleanRemarks(remarks: unknown): string | null {
  if (typeof remarks !== "string") return null;
  const text = remarks.trim().slice(0, REMARKS_MAX);
  return text.length > 0 ? text : null;
}
