// Overtime rules (4.7). Pure: no database access.
// Labour Act 2074:
//   §29 nobody is made to work overtime against their will (hence approval);
//   §30 at most 4 hours a day and 24 hours a week;
//   §31 paid at 1.5 times the basic remuneration, which (§2) includes the
//       yearly increment, here the grade. Hourly rate: (basic + grade) ÷ 240
//       (30 days × 8 hours).
// Work on a weekly off or holiday earns a substitute day off (§42, Leave);
// only the hours beyond a full day are overtime (attendance-day.engine.ts).

import Decimal from "decimal.js";
import { addDays, weekdayOf } from "@/lib/engines/pay-period.engine";
import type { OvertimeDetail, OvertimeEntry, OvertimeLine, OvertimePolicy, OvertimeState } from "@/lib/types/overtime";

export const OT_LEGAL = {
  /** §31: overtime is paid at least 1.5 times the hourly rate. */
  minRate: 1.5,
  /** §30: at most 4 hours a day and 24 hours a week. */
  dailyMinutes: 240,
  weeklyMinutes: 1440,
  /** Hours in a month for the hourly rate: 30 days × 8 hours. */
  hoursPerMonth: 240,
} as const;

/** A rate above this is almost certainly a typing mistake. */
export const OT_MAX_RATE = 5;

/** What a new company starts with: the law's rates and approval required. */
export const LAWFUL_OVERTIME: OvertimePolicy = { workRate: 1.5, offRate: 1.5, rounding: 0, roundingMode: "down", approval: "required" };

/** Where the company's policy is kept (system_config, JSON). */
export const OVERTIME_POLICY_KEY = "overtime.policy";

/**
 * The policy a new company starts with (provisioning, onboarding, the
 * platform's company setup): an optional rate from the platform, never below
 * the law, approval required. Written only when the company has none.
 */
export function seedPolicy(multiplier?: number | null): OvertimePolicy {
  const m = Number(multiplier);
  const rate = Number.isFinite(m) ? Math.min(Math.max(m, OT_LEGAL.minRate), OT_MAX_RATE) : OT_LEGAL.minRate;
  return { ...LAWFUL_OVERTIME, workRate: rate, offRate: rate };
}

const ROUNDINGS = [0, 15, 30] as const;

/** A stored or submitted policy, cleaned: unknown values fall back to `fallback`. */
export function normalizePolicy(raw: unknown, fallback: OvertimePolicy = LAWFUL_OVERTIME): OvertimePolicy {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rate = (v: unknown, d: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : d;
  };
  const rounding = Number(o.rounding);
  return {
    workRate: rate(o.workRate, fallback.workRate),
    offRate: rate(o.offRate, fallback.offRate),
    rounding: (ROUNDINGS as readonly number[]).includes(rounding) ? (rounding as OvertimePolicy["rounding"]) : fallback.rounding,
    roundingMode: o.roundingMode === "nearest" || o.roundingMode === "down" ? o.roundingMode : fallback.roundingMode,
    approval: o.approval === "auto" || o.approval === "required" ? o.approval : fallback.approval,
  };
}

/** Problems with a policy, by field (empty: it can be saved). */
export function validatePolicy(p: OvertimePolicy): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ["workRate", "offRate"] as const) {
    if (!(p[key] >= OT_LEGAL.minRate)) errors[key] = `The Labour Act's minimum is ${OT_LEGAL.minRate} times the hourly rate (§31)`;
    else if (p[key] > OT_MAX_RATE) errors[key] = `Check the rate: at most ${OT_MAX_RATE} times`;
  }
  return errors;
}

/** A policy raised to the law where it falls below it (older settings, platform values). */
export function lawful(p: OvertimePolicy): OvertimePolicy {
  return { ...p, workRate: Math.max(p.workRate, OT_LEGAL.minRate), offRate: Math.max(p.offRate, OT_LEGAL.minRate) };
}

/** The hourly rate: (basic + grade) ÷ 240. */
export function hourlyRate(salary: { basic: number; grade: number }): Decimal {
  return new Decimal(salary.basic || 0).plus(salary.grade || 0).dividedBy(OT_LEGAL.hoursPerMonth);
}

/**
 * Minutes rounded to whole blocks (block 0 = as they are). "down": only full
 * blocks (1 h 44 → 1 h 30 with 15); "nearest": a half block or more goes up
 * (1 h 44 → 1 h 45, 1 h 37 → 1 h 30, 1 h 38 → 1 h 45 with 15).
 */
export function roundMinutes(minutes: number, rounding: Pick<OvertimePolicy, "rounding" | "roundingMode">): number {
  const m = Math.max(0, Math.floor(minutes || 0));
  const block = rounding.rounding;
  if (!block) return m;
  return rounding.roundingMode === "nearest" ? Math.round(m / block) * block : Math.floor(m / block) * block;
}

/** A month's overtime minutes to pay: each day rounded on its own, then added up. */
export function payableMinutes(days: readonly { otWorkDayMinutes: number; otOffDayMinutes: number }[], rounding: Pick<OvertimePolicy, "rounding" | "roundingMode">): { work: number; off: number } {
  let work = 0;
  let off = 0;
  for (const d of days) {
    work += roundMinutes(d.otWorkDayMinutes, rounding);
    off += roundMinutes(d.otOffDayMinutes, rounding);
  }
  return { work, off };
}

/** The rounding in words: "Not rounded", "Down to whole 15 minutes", "To the nearest 30 minutes". */
export function describeRounding(p: Pick<OvertimePolicy, "rounding" | "roundingMode">): string {
  if (!p.rounding) return "Not rounded";
  return p.roundingMode === "nearest" ? `To the nearest ${p.rounding} minutes` : `Down to whole ${p.rounding} minutes`;
}

export interface OvertimePay {
  /** The amount, to 2 decimals. */
  amount: number;
  /** (basic + grade) ÷ 240, to 2 decimals (the payslip shows it). */
  hourlyRate: number;
  workHours: number;
  offHours: number;
}

/** Overtime pay for a month's payable minutes: hours × hourly rate × the policy's rate for that kind of day. */
export function otPay(minutes: { work: number; off: number }, salary: { basic: number; grade: number } | undefined, policy: Pick<OvertimePolicy, "workRate" | "offRate">): OvertimePay {
  const workHours = Math.round(((minutes.work || 0) / 60) * 100) / 100;
  const offHours = Math.round(((minutes.off || 0) / 60) * 100) / 100;
  if (!salary) return { amount: 0, hourlyRate: 0, workHours, offHours };
  const hourly = hourlyRate(salary);
  const amount = hourly
    .times(new Decimal(minutes.work || 0).dividedBy(60))
    .times(policy.workRate)
    .plus(hourly.times(new Decimal(minutes.off || 0).dividedBy(60)).times(policy.offRate))
    .toDecimalPlaces(2)
    .toNumber();
  return { amount, hourlyRate: hourly.toDecimalPlaces(2).toNumber(), workHours, offHours };
}

/** Rates in words: "1.5× on working days, 2× beyond a full day on weekly offs and holidays". */
export function describeRates(p: Pick<OvertimePolicy, "workRate" | "offRate">): string {
  const x = (n: number) => `${Number(n.toFixed(2))}×`;
  return `${x(p.workRate)} on working days, ${x(p.offRate)} beyond a full day on weekly offs and holidays`;
}

/** The amount with how it was worked out (kept on the month summary and the payslip). */
export function otDetail(minutes: { work: number; off: number }, salary: { basic: number; grade: number } | undefined, policy: Pick<OvertimePolicy, "workRate" | "offRate">): OvertimeDetail {
  const p = otPay(minutes, salary, policy);
  return { amount: p.amount, hourlyRate: p.hourlyRate, workHours: p.workHours, offHours: p.offHours, workRate: policy.workRate, offRate: policy.offRate };
}

/** "6.5 h × NPR 199.79 × 1.5" (and the off-day part when there is one): the payslip's overtime line. */
export function describeDetail(d: OvertimeDetail): string {
  const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const part = (hours: number, rate: number) => `${Number(hours.toFixed(2))} h × NPR ${money(d.hourlyRate)} × ${Number(rate.toFixed(2))}`;
  const parts = [d.workHours > 0 ? part(d.workHours, d.workRate) : "", d.offHours > 0 ? `${part(d.offHours, d.offRate)} (weekly off / holiday)` : ""].filter(Boolean);
  return parts.join(" + ");
}

/** describeDetail in Nepali, for the bilingual payslip (F11); the figures stay as printed. */
export function describeDetailNp(d: OvertimeDetail): string {
  const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const part = (hours: number, rate: number) => `${Number(hours.toFixed(2))} घण्टा × रु ${money(d.hourlyRate)} × ${Number(rate.toFixed(2))}`;
  const parts = [d.workHours > 0 ? part(d.workHours, d.workRate) : "", d.offHours > 0 ? `${part(d.offHours, d.offRate)} (साप्ताहिक बिदा / बिदा)` : ""].filter(Boolean);
  return parts.join(" + ");
}

// ---------------------------------------------------------------------------
// 4.7b Approvals: what each overtime day pays, and what waits for a decision
// ---------------------------------------------------------------------------

/** Longest overtime one entry may ask for (a whole day). */
export const OT_MAX_ENTRY_MINUTES = 720;

/** States that need a decision (and stop the month from closing). */
export const WAITING_STATES: readonly OvertimeState[] = ["waiting", "changed"];

/**
 * Days over the legal limits (§30): more than 4 hours of overtime that day,
 * or in a week (Sunday to Saturday) with more than 24 hours. Text by date.
 */
export function limitBreaches(minutesByDate: ReadonlyMap<string, number>): Map<string, string> {
  const out = new Map<string, string>();
  const weeks = new Map<string, { total: number; dates: string[] }>();
  for (const [date, minutes] of minutesByDate) {
    if (minutes <= 0) continue;
    if (minutes > OT_LEGAL.dailyMinutes) out.set(date, "Over 4 hours this day");
    const sunday = addDays(date, -weekdayOf(date));
    const w = weeks.get(sunday) ?? { total: 0, dates: [] };
    w.total += minutes;
    w.dates.push(date);
    weeks.set(sunday, w);
  }
  for (const w of weeks.values()) {
    if (w.total <= OT_LEGAL.weeklyMinutes) continue;
    for (const date of w.dates) if (!out.has(date)) out.set(date, "Week over 24 hours");
  }
  return out;
}

/** What an entry counts towards the day's overtime (for the limits): asked for or approved; nothing once refused. */
const entryMinutes = (e: OvertimeEntry) => (e.status === "approved" ? e.approvedMinutes : e.status === "pending" ? e.requestedMinutes : 0);

/**
 * One employee's overtime for some days: a line per day with detected
 * overtime and per overtime added by hand, what each pays (rounded day by
 * day) and how many wait for a decision.
 * - Approval required: only decided (approved) minutes are paid.
 * - Automatic: detected overtime is paid, except days over the legal limits,
 *   which wait.
 * - A decided day whose detected minutes have changed since waits again.
 * - Added by hand: always decided.
 */
export function monthOvertime(
  employeeId: string,
  days: readonly { date: string; otWorkDayMinutes: number; otOffDayMinutes: number }[],
  entries: readonly OvertimeEntry[],
  policy: Pick<OvertimePolicy, "approval" | "rounding" | "roundingMode">
): { lines: OvertimeLine[]; paid: { work: number; off: number }; waiting: number } {
  const mine = entries.filter((e) => e.employeeId === employeeId);
  const detectedEntry = new Map(mine.filter((e) => e.source === "detected").map((e) => [e.workDate, e]));
  const manual = mine.filter((e) => e.source === "manual");
  const detected = days
    .map((d) => ({ date: d.date, minutes: Math.max(0, d.otWorkDayMinutes) + Math.max(0, d.otOffDayMinutes), kind: d.otOffDayMinutes > 0 ? ("off" as const) : ("work" as const) }))
    .filter((d) => d.minutes > 0);

  const total = new Map<string, number>();
  for (const d of detected) total.set(d.date, (total.get(d.date) ?? 0) + d.minutes);
  for (const e of manual) total.set(e.workDate, (total.get(e.workDate) ?? 0) + entryMinutes(e));
  const limits = limitBreaches(total);

  const lines: OvertimeLine[] = [];
  for (const d of detected) {
    const entry = detectedEntry.get(d.date) ?? null;
    const overLimit = limits.has(d.date);
    let state: OvertimeState;
    let paid = 0;
    if (entry && entry.detectedMinutes === d.minutes && (entry.status === "approved" || entry.status === "rejected")) {
      state = entry.status;
      paid = entry.status === "approved" ? Math.min(entry.approvedMinutes, d.minutes) : 0;
    } else if (entry && (entry.status === "approved" || entry.status === "rejected")) {
      state = "changed";
    } else if (policy.approval === "auto" && !overLimit) {
      state = "auto";
      paid = d.minutes;
    } else {
      state = "waiting";
    }
    lines.push({
      employeeId,
      date: d.date,
      source: "detected",
      kind: d.kind,
      minutes: d.minutes,
      approvedMinutes: entry && (entry.status === "approved" || entry.status === "rejected") ? entry.approvedMinutes : null,
      paidMinutes: roundMinutes(paid, policy),
      state,
      overLimit,
      limitText: limits.get(d.date) ?? null,
      entry,
    });
  }
  for (const e of manual) {
    const state: OvertimeState = e.status === "pending" ? "waiting" : e.status;
    lines.push({
      employeeId,
      date: e.workDate,
      source: "manual",
      kind: e.dayKind,
      minutes: e.requestedMinutes,
      approvedMinutes: e.status === "approved" || e.status === "rejected" ? e.approvedMinutes : null,
      paidMinutes: e.status === "approved" ? roundMinutes(e.approvedMinutes, policy) : 0,
      state,
      overLimit: limits.has(e.workDate),
      limitText: limits.get(e.workDate) ?? null,
      entry: e,
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
  const paid = { work: 0, off: 0 };
  for (const l of lines) paid[l.kind] += l.paidMinutes;
  return { lines, paid, waiting: lines.filter((l) => WAITING_STATES.includes(l.state)).length };
}

/** Whether an approver may decide a line now: it waits, or it is paid automatically (it may still be cut or refused). */
export function decidable(line: Pick<OvertimeLine, "state">): boolean {
  return line.state === "waiting" || line.state === "changed" || line.state === "auto";
}
