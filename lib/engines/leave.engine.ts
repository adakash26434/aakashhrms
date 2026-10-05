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
  not_granted: 0,
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
// Entitlements (4.6b): expiry, home leave earned, carry-over, the year opening
// ---------------------------------------------------------------------------

/** A ledger line as the balance needs it. */
export interface BalanceLine {
  id?: string;
  kind: LedgerKind;
  days: number;
  entryDate: string;
  expiresOn: string | null;
  createdAt?: string;
}

export interface BalanceBucket {
  id: string | undefined;
  expiresOn: string;
  left: number;
}

/**
 * The balance usable on a date. Lines with an expiry (substitute leave
 * grants, §42) are used oldest-expiry first and stop counting once they
 * expire; everything else counts as it is. Days that expired unused are
 * listed so the month close can write them off (the `expired` lines it
 * writes are not counted again). Without expiring lines this is the ledger
 * sum.
 */
export function balanceOn(
  lines: readonly BalanceLine[],
  date: string
): { available: number; buckets: BalanceBucket[]; free: number; expired: { id: string | undefined; expiresOn: string; days: number }[] } {
  const sorted = [...lines].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const buckets: BalanceBucket[] = [];
  const expired: { id: string | undefined; expiresOn: string; days: number }[] = [];
  let free = 0;
  const expireBefore = (d: string) => {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i].expiresOn < d) {
        const [b] = buckets.splice(i, 1);
        if (b.left > 0) expired.push({ id: b.id, expiresOn: b.expiresOn, days: round(b.left) });
      }
    }
  };
  for (const l of sorted) {
    // A written-off expiry mirrors what the expiry here already removed.
    if (l.kind === "expired") continue;
    expireBefore(l.entryDate);
    if (l.days > 0 && l.expiresOn) buckets.push({ id: l.id, expiresOn: l.expiresOn, left: l.days });
    else if (l.days > 0) free += l.days;
    else if (l.days < 0) {
      let need = -l.days;
      for (const b of [...buckets].sort((x, y) => x.expiresOn.localeCompare(y.expiresOn))) {
        if (need <= 0) break;
        const use = Math.min(b.left, need);
        b.left -= use;
        need -= use;
      }
      free -= need;
    }
  }
  expireBefore(date);
  const live = buckets.filter((b) => b.left > 0).map((b) => ({ ...b, left: round(b.left) }));
  return { available: round(free + live.reduce((n, b) => n + b.left, 0)), buckets: live, free: round(free), expired: expired.sort((x, y) => x.expiresOn.localeCompare(y.expiresOn)) };
}

/**
 * The balance on the first day of the start month: what happened before it,
 * plus the lines that set up the year whatever their date (opening and
 * starting balances, the year's credit and carry-over on its first day, the
 * switch from up-front home leave).
 */
export function balanceAtStart(lines: readonly (BalanceLine & { ref?: string | null })[], start: string): number {
  const setsUpYear = (l: (typeof lines)[number]) =>
    l.kind === "opening" || (l.entryDate === start && (l.kind === "credit" || l.kind === "carried_forward")) || (l.ref ?? "").startsWith("start:") || (l.ref ?? "").startsWith("home-earned:");
  return balanceOn(
    lines.filter((l) => l.entryDate < start || setsUpYear(l)),
    start
  ).available;
}

/** Labour Act §43: home leave earned in a month, 1 day per N paid days (2 decimals). */
export function homeLeaveEarned(paidDays: number, everyDays: number | null): number {
  const n = everyDays && everyDays > 0 ? everyDays : 20;
  return paidDays > 0 ? round(paidDays / n) : 0;
}

/** One attendance month of a leave year, for the home leave view. */
export interface HomeMonthInput {
  label: string;
  start: string;
  end: string;
  /** The month is closed for the person's branch (its home leave has been added). */
  closed: boolean;
  /** Paid days stored when the month was closed. */
  closedPaidDays: number | null;
  /** Home leave posted for the month (net of any reopen). */
  posted: number;
  /** Open month: paid days so far, from attendance (unknown = null). */
  livePaidDays?: number | null;
  /** Before the company started keeping leave here: in the starting balance. */
  beforeStart?: boolean;
}

export interface HomeMonth {
  label: string;
  start: string;
  end: string;
  /** closed: added to the balance; waiting: over, not closed yet; open: under way; to_come: not started; before: in the starting balance; outside: not employed then. */
  status: "closed" | "waiting" | "open" | "to_come" | "before" | "outside";
  paidDays: number | null;
  earned: number | null;
}

const daysBetween = (from: string, to: string) => (from > to ? 0 : Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);

/**
 * Home leave month by month for a leave year (Labour Act §43): what each
 * closed month added, what an open month has earned so far (added when it
 * closes), and the most the year can give if every remaining day is paid.
 */
export function homeLeaveMonths(p: { months: readonly HomeMonthInput[]; joiningDate: string; terminationDate: string | null; today: string; everyDays: number | null }): { months: HomeMonth[]; earned: number; upTo: number } {
  const n = p.everyDays && p.everyDays > 0 ? p.everyDays : 20;
  let earned = 0;
  let upTo = 0;
  const months = p.months.map((m): HomeMonth => {
    const from = m.start > p.joiningDate ? m.start : p.joiningDate;
    const to = p.terminationDate && p.terminationDate < m.end ? p.terminationDate : m.end;
    const employed = daysBetween(from, to);
    const base = { label: m.label, start: m.start, end: m.end };
    if (m.beforeStart) return { ...base, status: "before", paidDays: null, earned: null };
    if (m.closed) {
      earned += m.posted;
      upTo += m.posted;
      return { ...base, status: "closed", paidDays: m.closedPaidDays, earned: round(m.posted) };
    }
    if (!employed) return { ...base, status: "outside", paidDays: null, earned: null };
    if (m.start > p.today) {
      upTo += employed / n;
      return { ...base, status: "to_come", paidDays: null, earned: null };
    }
    // Under way (or over but not closed): what attendance shows so far, plus the days still to come.
    const so = m.livePaidDays ?? null;
    const rest = daysBetween(p.today > from ? p.today : from, to);
    upTo += so === null ? employed / n : so / n + rest / n;
    return { ...base, status: m.end < p.today ? "waiting" : "open", paidDays: so, earned: so === null ? null : homeLeaveEarned(so, n) };
  });
  return { months, earned: round(earned), upTo: round(upTo) };
}

/** What carries into the next leave year (up to the cap) and what is over it. A negative balance carries as it is. */
export function carryOver(closing: number, cap: number | null): { carry: number; over: number } {
  if (closing <= 0 || cap === null) return { carry: round(closing), over: 0 };
  return { carry: round(Math.min(closing, cap)), over: round(Math.max(0, closing - cap)) };
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000;

/** A yearly credit for someone who joins during the year: the share of the year left from joining (1 decimal). */
export function proRata(days: number, joiningDate: string, year: { start: string; end: string }): number {
  if (joiningDate <= year.start) return days;
  if (joiningDate > year.end) return 0;
  const total = dayNumber(year.end) - dayNumber(year.start) + 1;
  const left = dayNumber(year.end) - dayNumber(joiningDate) + 1;
  return Math.round(((days * left) / total) * 10) / 10;
}

/** The cap of a balance type: its own, else the Labour Act's for statutory types (home 90, sick 45). */
export function capOf(t: Pick<LeaveRuleType, "accumulationCap" | "statutoryCode">): number | null {
  return t.accumulationCap ?? (t.statutoryCode ? STATUTORY_FLOOR[t.statutoryCode]?.cap ?? null : null);
}

/** Types credited a number of days each year (sick 12, company types); home leave is earned and substitute leave granted. */
export const creditedYearly = (t: Pick<LeaveRuleType, "kind" | "statutoryCode" | "days">) =>
  t.kind === "balance" && t.statutoryCode !== "HOME" && t.statutoryCode !== "SUBSTITUTE" && t.days > 0;

export interface OpeningPerson {
  id: string;
  gender: string;
  joiningDate: string;
  terminationDate: string | null;
}

export interface OpeningRow {
  employeeId: string;
  leaveTypeId: string;
  /** Usable at the old year's end. */
  closing: number;
  carry: number;
  /** Over the cap (or not carried): to be paid out at basic salary, or lapsed. */
  over: number;
  overKind: "paid_out" | "lapsed" | null;
  credit: number;
  /** The new year's balance after opening. */
  opening: number;
}

export interface OpeningLine {
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  entryDate: string;
  kind: LedgerKind;
  days: number;
  note: string;
  expiresOn: string | null;
  ref: string;
}

/**
 * Opening a leave year (Labour Act §49, §50). For everyone employed on its
 * first day, each balance type's usable days at the old year's end carry
 * over up to the cap (home 90, sick 45, a company type's own cap if it
 * carries over); what is over is marked to be paid out at basic salary
 * (statutory types, encashable company types) or lapses. Substitute leave
 * keeps each grant's expiry. Sick leave and company types are credited for
 * the year (pro-rata for someone who joined during it and was not credited
 * at hire).
 */
export function planOpening(p: {
  types: readonly LeaveRuleType[];
  people: readonly OpeningPerson[];
  oldYear: { id: string; label: string; end: string } | null;
  newYear: { id: string; label: string; start: string; end: string };
  /** Old-year lines per `employee|type`. */
  oldLines: ReadonlyMap<string, readonly BalanceLine[]>;
  /** `employee|type` pairs already credited in the new year (at hire). */
  creditedInNewYear: ReadonlySet<string>;
}): { rows: OpeningRow[]; lines: OpeningLine[] } {
  const rows: OpeningRow[] = [];
  const lines: OpeningLine[] = [];
  const ref = `opening:${p.newYear.id}`;
  const types = p.types.filter((t) => t.kind === "balance" && t.isActive);
  for (const e of p.people) {
    if (e.terminationDate && e.terminationDate < p.newYear.start) continue;
    if (e.joiningDate > p.newYear.end) continue;
    for (const t of types) {
      if (t.genderApplicable !== "All" && t.genderApplicable !== e.gender) continue;
      const key = `${e.id}|${t.id}`;
      const old = p.oldYear ? balanceOn(p.oldLines.get(key) ?? [], p.oldYear.end) : null;
      const closing = old?.available ?? 0;
      let carry = 0;
      let over = 0;
      let overKind: OpeningRow["overKind"] = null;
      const line = (kind: LedgerKind, days: number, note: string, expiresOn: string | null = null, oldYear = false) =>
        lines.push({
          employeeId: e.id,
          leaveTypeId: t.id,
          fiscalYearId: oldYear && p.oldYear ? p.oldYear.id : p.newYear.id,
          entryDate: oldYear && p.oldYear ? p.oldYear.end : p.newYear.start,
          kind,
          days,
          note,
          expiresOn,
          ref,
        });
      if (old && p.oldYear) {
        if (t.statutoryCode === "SUBSTITUTE") {
          // Each grant keeps its own expiry; only what is still usable on the first day moves.
          for (const b of old.buckets.filter((x) => x.expiresOn >= p.newYear.start)) {
            line("carried_forward", b.left, `From ${p.oldYear.label}, expires ${b.expiresOn}`, b.expiresOn);
            carry += b.left;
          }
          if (old.free !== 0) {
            line("carried_forward", old.free, `From ${p.oldYear.label}`);
            carry += old.free;
          }
        } else {
          const carries = t.isStatutory || t.carryForward;
          const cap = capOf(t);
          const c = carries ? carryOver(closing, cap) : { carry: round(Math.min(closing, 0)), over: round(Math.max(closing, 0)) };
          carry = c.carry;
          over = c.over;
          if (carry !== 0) line("carried_forward", carry, `From ${p.oldYear.label}`);
          if (over > 0) {
            overKind = t.isStatutory || t.isEncashable ? "paid_out" : "lapsed";
            line(
              overKind,
              -over,
              overKind === "paid_out"
                ? carries && cap !== null
                  ? `Over the ${fmt(cap)}-day limit: to be paid at basic salary (Labour Act §49)`
                  : "Not carried over: to be paid at basic salary"
                : `Not carried over to ${p.newYear.label}`,
              null,
              true
            );
          }
        }
      }
      let credit = 0;
      if (creditedYearly(t) && !p.creditedInNewYear.has(key)) {
        credit = proRata(t.days, e.joiningDate, p.newYear);
        if (credit > 0) {
          const joined = e.joiningDate > p.newYear.start;
          lines.push({
            employeeId: e.id,
            leaveTypeId: t.id,
            fiscalYearId: p.newYear.id,
            entryDate: joined ? e.joiningDate : p.newYear.start,
            kind: "credit",
            days: credit,
            note: joined ? `${p.newYear.label}, pro-rata from joining` : p.newYear.label,
            expiresOn: null,
            ref,
          });
        }
      }
      rows.push({ employeeId: e.id, leaveTypeId: t.id, closing, carry: round(carry), over, overKind, credit, opening: round(carry + credit) });
    }
  }
  return { rows, lines };
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
