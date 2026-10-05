// Attendance day rules (4.5): one engine decides how every employee-day
// counts, and sums a month for payroll. The first rule that applies wins:
//   1 not employed · 2 HR override · 3 holiday · 4 weekly off · 5 full-day
//   approved leave · 6 punches (present / half day / absent; half-day leave
//   covers half) · 7 one punch only = missing punch · 8 nothing = company
//   setting (absent by default).
// Times: punches are instants (ISO, UTC); shift times are Nepal local time
// (UTC+05:45). The day's shift (4.5b: `lib/engines/shift.engine.ts`) says
// whether it is a weekly off and which hours apply. A punch belongs to the
// day whose shift it is nearest: the gap between one day's shift end and the
// next day's start is split in the middle, so a night shift keeps its
// morning punches. Pure: no database access.

import { addDays, utcDate, weekdayOf } from "@/lib/engines/pay-period.engine";
import { DAY_CODE, type AttendanceRules, type DayLeave, type DayResult, type DayType, type MonthSummary, type OverrideType, type ShiftRule } from "@/lib/types/attendance";
import type { PayPeriod } from "@/lib/engines/pay-period.engine";

/** Nepal is UTC+05:45 all year (no daylight saving). */
export const NEPAL_OFFSET_MINUTES = 345;
/** Labour Act 2074: overtime at most 4 hours a day and 24 hours a week. */
export const OT_DAILY_LIMIT_MINUTES = 240;
export const OT_WEEKLY_LIMIT_MINUTES = 1440;
/** Labour Act: half an hour's rest after 5 hours; the break counts only on days longer than that. */
const BREAK_AFTER_MINUTES = 300;
const WINDOW_BEFORE_START = 240;

export const DEFAULT_SHIFT: ShiftRule = {
  id: null,
  code: "GEN",
  name: "General",
  start: "10:00",
  end: "18:00",
  breakMinutes: 30,
  graceMinutes: 15,
  fullDayMinutes: 420,
  halfDayMinutes: 240,
  otMinimumMinutes: 30,
  off: false,
  flexible: false,
};

export const DEFAULT_RULES: AttendanceRules = {
  calendar: "BS",
  noRecord: "absent",
  lateRule: { enabled: false, count: 3 },
  webCheckIn: { enabled: false },
};

/** "HH:MM" (24-hour) → minutes after midnight; null when not a time. */
export function clockMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm?.trim() ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Minutes after the local (Nepal) midnight that starts `date` for an instant. */
export function minutesIntoDay(instant: string, date: string): number {
  return Math.round((new Date(instant).getTime() - utcDate(date).getTime()) / 60000) + NEPAL_OFFSET_MINUTES;
}

/** The instant (ISO, UTC) for a local time on a date (minutes may exceed 1440 for the next day). */
export function instantAt(date: string, minutes: number): string {
  return new Date(utcDate(date).getTime() + (minutes - NEPAL_OFFSET_MINUTES) * 60000).toISOString();
}

/** The shift's start and end in minutes into its day (end > start; past 1440 when it crosses midnight). */
export function shiftSpan(shift: ShiftRule): { start: number; end: number; length: number } {
  const start = clockMinutes(shift.start) ?? 600;
  let end = clockMinutes(shift.end) ?? 1080;
  if (end <= start) end += 1440;
  return { start, end, length: end - start };
}

/** Where one day's punches stop and the next day's start: the middle of the gap between the shifts (the next start when they overlap). */
function boundary(endPrev: number, startNext: number): number {
  return endPrev < startNext ? Math.floor((endPrev + startNext) / 2) : startNext;
}

/**
 * The window of instants whose punches belong to this day. With the shifts
 * of the day before and after, the gaps between them are split in the
 * middle; without them, 4 hours before the start to 20 hours after.
 */
export function dayWindow(date: string, shift: ShiftRule, prev?: ShiftRule | null, next?: ShiftRule | null): { from: string; to: string } {
  const own = shiftSpan(shift);
  const ms = (d: string, minutes: number) => new Date(instantAt(d, minutes)).getTime();
  const startMs = ms(date, own.start);
  const endMs = ms(date, own.end);
  const from = prev ? boundary(ms(addDays(date, -1), shiftSpan(prev).end), startMs) : ms(date, own.start - WINDOW_BEFORE_START);
  const to = next ? boundary(endMs, ms(addDays(date, 1), shiftSpan(next).start)) : ms(date, own.start - WINDOW_BEFORE_START + 1440);
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

/** Punches (instants) inside the day's window, oldest first. */
export function punchesForDay(punches: readonly string[], date: string, shift: ShiftRule, prev?: ShiftRule | null, next?: ShiftRule | null): string[] {
  const { from, to } = dayWindow(date, shift, prev, next);
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return punches.filter((p) => {
    const t = new Date(p).getTime();
    return t >= a && t < b;
  }).sort();
}

export interface DayInput {
  date: string;
  /** Joining date and last working date (AD); the employee is employed between them. */
  employedFrom: string;
  employedUntil: string | null;
  shift: ShiftRule;
  noRecord: AttendanceRules["noRecord"];
  holiday: { name: string } | null;
  leave: DayLeave | null;
  /** Punches already limited to this day's window, oldest first. */
  punches: readonly string[];
  override: { dayType: OverrideType; reason: string } | null;
  /** The employment type allows overtime. */
  otEligible: boolean;
  /** Today (Nepal): a later working day with nothing on it is upcoming, not absent. */
  today?: string;
  /** The current instant: today, a working day with nothing on it is "not in yet" until the shift ends. */
  now?: string;
}

const base = (date: string, shift?: ShiftRule): Omit<DayResult, "dayType" | "payable" | "unpaid" | "rule"> => ({
  date,
  shift: shift ? { id: shift.id, code: shift.code, name: shift.name, start: shift.start, end: shift.end, season: shift.season ?? null } : null,
  firstIn: null,
  lastOut: null,
  workMinutes: 0,
  lateMinutes: 0,
  earlyMinutes: 0,
  otWorkDayMinutes: 0,
  otOffDayMinutes: 0,
  leaveDays: 0,
  leavePaidDays: 0,
  flags: [],
});

/** Times from punches: first in, last out, minutes worked, late, early and overtime. */
function measure(input: DayInput, offDay: boolean) {
  const out = base(input.date, input.shift);
  const p = input.punches;
  if (!p.length) return { ...out, punchCount: 0 };
  out.firstIn = p[0];
  if (p.length < 2) return { ...out, punchCount: 1 };
  out.lastOut = p[p.length - 1];
  const span = shiftSpan(input.shift);
  const inAt = minutesIntoDay(out.firstIn, input.date);
  const outAt = minutesIntoDay(out.lastOut, input.date);
  const spanWorked = Math.max(0, outAt - inAt);
  out.workMinutes = Math.max(0, spanWorked - (spanWorked > BREAK_AFTER_MINUTES ? input.shift.breakMinutes : 0));
  if (offDay) {
    out.otOffDayMinutes = input.otEligible && out.workMinutes >= input.shift.otMinimumMinutes ? out.workMinutes : 0;
    return { ...out, punchCount: p.length };
  }
  // Flexible hours: no late or early; overtime after a full day's hours.
  if (!input.shift.flexible) {
    if (inAt > span.start + input.shift.graceMinutes) out.lateMinutes = inAt - span.start;
    if (outAt < span.end) out.earlyMinutes = span.end - outAt;
  }
  const planned = input.shift.flexible ? input.shift.fullDayMinutes : span.length - (span.length > BREAK_AFTER_MINUTES ? input.shift.breakMinutes : 0);
  const extra = out.workMinutes - planned;
  out.otWorkDayMinutes = input.otEligible && extra >= input.shift.otMinimumMinutes ? extra : 0;
  return { ...out, punchCount: p.length };
}

/** How one employee-day counts (see the rule order at the top of this file). */
export function resolveDay(input: DayInput): DayResult {
  const d = input.date;
  // 1. Outside employment: neither paid nor an absence.
  if (d < input.employedFrom || (input.employedUntil && d > input.employedUntil)) {
    return { ...base(d, input.shift), dayType: "not_employed", payable: 0, unpaid: 0, rule: d < input.employedFrom ? "Before joining" : "After leaving" };
  }
  const offDay = !!input.holiday || input.shift.off;
  const m = measure(input, offDay && !input.override);
  const { punchCount, ...times } = m;
  const flags: DayResult["flags"] = [];
  const withFlags = (r: Omit<DayResult, "flags"> & { flags?: DayResult["flags"] }): DayResult => {
    const all = [...flags, ...(r.flags ?? [])];
    if (r.lateMinutes > 0) all.push("late");
    if (r.earlyMinutes > 0) all.push("early");
    if (r.otWorkDayMinutes + r.otOffDayMinutes > OT_DAILY_LIMIT_MINUTES) all.push("ot_over_daily_limit");
    return { ...r, flags: [...new Set(all)] };
  };

  // 2. HR override (reason recorded): wins over the calendar and punches.
  if (input.override) {
    flags.push("override");
    const t = input.override.dayType;
    const pay = t === "half_day" ? 0.5 : t === "absent" || t === "unpaid_leave" ? 0 : 1;
    const onLeave = t === "paid_leave" || t === "unpaid_leave" ? { leaveDays: 1, leavePaidDays: pay } : {};
    return withFlags({ ...times, ...onLeave, dayType: t, payable: pay, unpaid: 1 - pay, rule: `Set by HR: ${input.override.reason}` });
  }
  // 3. Holiday (paid); hours worked are off-day overtime.
  if (input.holiday) {
    return withFlags({ ...times, dayType: "holiday", payable: 1, unpaid: 0, rule: `Holiday: ${input.holiday.name}`, holidayName: input.holiday.name });
  }
  // 4. Weekly off (paid); hours worked are off-day overtime.
  if (input.shift.off) {
    return withFlags({ ...times, dayType: "weekly_off", payable: 1, unpaid: 0, rule: "Weekly off" });
  }
  // 5. Approved full-day leave (Partial-Pay pays half).
  const leave = input.leave;
  const leavePay = leave ? (leave.pay === "full" ? 1 : leave.pay === "half" ? 0.5 : 0) : 0;
  if (leave && !leave.half) {
    return withFlags({
      ...times,
      lateMinutes: 0,
      earlyMinutes: 0,
      otWorkDayMinutes: 0,
      leaveDays: 1,
      leavePaidDays: leavePay,
      dayType: leavePay > 0 ? "paid_leave" : "unpaid_leave",
      payable: leavePay,
      unpaid: 1 - leavePay,
      rule: `Approved leave: ${leave.name}${leavePay === 0.5 ? " (half paid)" : leavePay === 0 ? " (unpaid)" : ""}`,
      leaveName: leave.name,
    });
  }
  // A half-day leave covers half the day; the other half has to be worked.
  const halfLeave = leave?.half ? { leaveDays: 0.5, leavePaidDays: 0.5 * leavePay, leaveName: leave.name } : { leaveDays: 0, leavePaidDays: 0, leaveName: null };
  const need = halfLeave.leaveDays ? 0.5 : 1;

  // 6. Two or more punches: the hours decide.
  if (punchCount >= 2) {
    const w = times.workMinutes;
    const worked = need === 0.5 ? (w >= input.shift.halfDayMinutes ? 0.5 : 0) : w >= input.shift.fullDayMinutes ? 1 : w >= input.shift.halfDayMinutes ? 0.5 : 0;
    const payable = worked + halfLeave.leavePaidDays;
    const dayType: DayType = worked === need ? (halfLeave.leaveDays ? "half_day" : "present") : worked > 0 ? "half_day" : "absent";
    const rule = halfLeave.leaveDays
      ? `Half-day leave (${halfLeave.leaveName}); ${worked ? "worked the other half" : "not enough hours for the other half"}`
      : worked === 1
        ? "Worked a full day"
        : worked === 0.5
          ? "Worked enough for a half day only"
          : "Worked less than a half day";
    return withFlags({ ...times, ...halfLeave, dayType, payable, unpaid: 1 - payable, rule });
  }
  // Today before the shift ends: in progress, not judged yet.
  const shiftNotOver = !!input.today && d === input.today && !!input.now && new Date(input.now).getTime() < new Date(instantAt(d, shiftSpan(input.shift).end)).getTime();
  if (punchCount === 1 && shiftNotOver) {
    return withFlags({ ...times, ...halfLeave, dayType: "upcoming", payable: 0, unpaid: 0, rule: `At work since ${localClock(times.firstIn)} (the shift ends at ${input.shift.end})` });
  }
  // 7. One punch only: needs an adjustment; counts as absent until corrected.
  if (punchCount === 1) {
    flags.push("missing_punch");
    return withFlags({ ...times, ...halfLeave, dayType: "missing_punch", payable: halfLeave.leavePaidDays, unpaid: 1 - halfLeave.leavePaidDays, rule: "Only one punch: needs an adjustment; counts as absent until then" });
  }
  // A day still to come with nothing on it is not counted yet.
  if (input.today && d > input.today) {
    return withFlags({ ...times, ...halfLeave, dayType: "upcoming", payable: 0, unpaid: 0, rule: "Still to come" });
  }
  // Today before the shift ends: not in yet, not absent.
  if (shiftNotOver) {
    return withFlags({ ...times, ...halfLeave, dayType: "upcoming", payable: 0, unpaid: 0, rule: `Not in yet (the shift ends at ${input.shift.end})` });
  }
  // 8. Nothing recorded: the company setting (absent by default).
  if (input.noRecord === "present") {
    flags.push("assumed_present");
    return withFlags({ ...times, ...halfLeave, dayType: "present", payable: 1 - halfLeave.leaveDays + halfLeave.leavePaidDays, unpaid: halfLeave.leaveDays - halfLeave.leavePaidDays, rule: "Nothing recorded: counted present (company setting)" });
  }
  if (halfLeave.leaveDays) {
    return withFlags({ ...times, ...halfLeave, dayType: "half_day", payable: halfLeave.leavePaidDays, unpaid: 1 - halfLeave.leavePaidDays, rule: `Half-day leave (${halfLeave.leaveName}); nothing recorded for the other half` });
  }
  return withFlags({ ...times, dayType: "absent", payable: 0, unpaid: 1, rule: "Nothing recorded: absent" });
}

/** A month's days summed for payroll (unpaid days include the late rule when it is on). */
export function summariseMonth(period: PayPeriod, days: readonly DayResult[], rules: Pick<AttendanceRules, "lateRule">): MonthSummary {
  const count = (t: DayType) => days.filter((d) => d.dayType === t).length;
  const sum = (f: (d: DayResult) => number) => days.reduce((n, d) => n + f(d), 0);
  const lateDays = days.filter((d) => d.lateMinutes > 0).length;
  const lateUnpaid = rules.lateRule.enabled && rules.lateRule.count > 0 ? Math.floor(lateDays / rules.lateRule.count) * 0.5 : 0;
  const otWarnings: string[] = [];
  for (const d of days) if (d.flags.includes("ot_over_daily_limit")) otWarnings.push(`${d.date}: more than 4 hours of overtime`);
  // Weeks run Sunday to Saturday (AD dates).
  const weeks = new Map<string, number>();
  for (const d of days) {
    const sunday = addDays(d.date, -weekdayOf(d.date));
    weeks.set(sunday, (weeks.get(sunday) ?? 0) + d.otWorkDayMinutes + d.otOffDayMinutes);
  }
  for (const [sunday, minutes] of weeks) if (minutes > OT_WEEKLY_LIMIT_MINUTES) otWarnings.push(`Week from ${sunday}: more than 24 hours of overtime`);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    calendar: period.calendar,
    periodYear: period.year,
    periodMonth: period.month,
    start: period.start,
    end: period.end,
    calendarDays: period.days,
    payableDays: round(Math.max(0, sum((d) => d.payable) - lateUnpaid)),
    unpaidDays: round(sum((d) => d.unpaid) + lateUnpaid),
    notEmployedDays: count("not_employed"),
    presentDays: count("present"),
    halfDays: count("half_day"),
    absentDays: count("absent"),
    missingPunchDays: count("missing_punch"),
    onDutyDays: count("on_duty"),
    paidLeaveDays: round(sum((d) => d.leavePaidDays)),
    unpaidLeaveDays: round(sum((d) => d.leaveDays - d.leavePaidDays)),
    holidayDays: count("holiday"),
    weeklyOffDays: count("weekly_off"),
    lateDays,
    earlyDays: days.filter((d) => d.earlyMinutes > 0).length,
    otWorkDayMinutes: sum((d) => d.otWorkDayMinutes),
    otOffDayMinutes: sum((d) => d.otOffDayMinutes),
    otWarnings,
  };
}

/**
 * The month's deduction for unpaid and not-employed days:
 * (basic + grade) ÷ days in the month × (unpaid + not-employed days).
 */
export function unpaidDeduction(basicPlusGrade: number, summary: Pick<MonthSummary, "calendarDays" | "unpaidDays" | "notEmployedDays">): number {
  if (!summary.calendarDays) return 0;
  const days = summary.unpaidDays + summary.notEmployedDays;
  return Math.round(((basicPlusGrade / summary.calendarDays) * days) * 100) / 100;
}

/** A day's name for people; a day still to come today is "Not in yet". */
export function dayName(day: Pick<DayResult, "dayType" | "date" | "firstIn">, today?: string): string {
  if (day.dayType === "upcoming") return today && day.date === today ? (day.firstIn ? "At work" : "Not in yet") : "Still to come";
  return DAY_CODE[day.dayType].name;
}

/** An instant as Nepal local "HH:MM" (for display). */
export function localClock(instant: string | null): string {
  if (!instant) return "";
  return new Date(new Date(instant).getTime() + NEPAL_OFFSET_MINUTES * 60000).toISOString().slice(11, 16);
}

/** An instant's Nepal calendar date "YYYY-MM-DD". */
export function localDate(instant: string): string {
  return new Date(new Date(instant).getTime() + NEPAL_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

/** Minutes as "7h 30m". */
export function hoursText(minutes: number): string {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
