// Shifts (4.5b): each company defines its own. A shift has hours, a week
// (each weekday working or off, with its own hours when they differ, e.g. a
// short Friday or a Saturday morning) and seasons (BS date ranges that come
// back every year with their own hours, e.g. Winter, Kartik 16 – Magh 15).
// This engine turns a shift and a date into that day's plan (`ShiftRule`),
// picks which shift applies (roster day → dated assignment → branch default
// → company default), fills rosters from a rotation, and checks a shift
// against the Labour Act 2074 (8 hours a day, 48 a week, rest after
// 5 hours, a weekly holiday, transport for women outside daylight).
// Pure: no database access.

import { addDays, bsDayOf, weekdayOf, WEEKDAYS } from "@/lib/engines/pay-period.engine";
import { clockMinutes, DEFAULT_SHIFT } from "@/lib/engines/attendance-day.engine";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import {
  SHIFT_COLORS,
  SHIFT_KINDS,
  type ShiftColor,
  type ShiftDefinition,
  type ShiftKind,
  type ShiftRule,
  type ShiftSeason,
  type ShiftSource,
  type ShiftWeekDay,
} from "@/lib/types/attendance";

/** Labour Act 2074: 8 hours a day, 48 a week; half an hour's rest after 5 hours. */
export const DAY_LIMIT_MINUTES = 480;
export const WEEK_LIMIT_MINUTES = 2880;
const BREAK_AFTER_MINUTES = 300;
export const MAX_SEASONS = 4;
/** A rotation fills at most this many days at once. */
export const MAX_ROTATION_DAYS = 92;

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Minutes from start to end ("HH:MM"); past midnight when the end is not after the start. */
export function spanMinutes(start: string, end: string): number {
  const a = clockMinutes(start) ?? 0;
  let b = clockMinutes(end) ?? 0;
  if (b <= a) b += 1440;
  return b - a;
}

/** Minutes to work in a span: the break comes off only when the span is longer than 5 hours. */
export function plannedMinutes(start: string, end: string, breakMinutes: number): number {
  const span = spanMinutes(start, end);
  return span > BREAK_AFTER_MINUTES ? span - breakMinutes : span;
}

// ---------------------------------------------------------------------------
// A day's plan
// ---------------------------------------------------------------------------

const bsCache = new Map<string, { month: number; day: number }>();
function bsMonthDay(date: string) {
  let v = bsCache.get(date);
  if (!v) {
    const bs = bsDayOf(date);
    v = { month: bs.month, day: bs.day };
    if (bsCache.size > 5000) bsCache.clear();
    bsCache.set(date, v);
  }
  return v;
}

/** The season (if any) a date falls in; ranges may wrap past Chaitra into Baisakh. */
export function seasonOn(seasons: readonly ShiftSeason[], date: string): ShiftSeason | null {
  if (!seasons.length) return null;
  const { month, day } = bsMonthDay(date);
  const x = month * 100 + day;
  return (
    seasons.find((s) => {
      const from = s.fromMonth * 100 + s.fromDay;
      const to = s.toMonth * 100 + s.toDay;
      return from <= to ? x >= from && x <= to : x >= from || x <= to;
    }) ?? null
  );
}

/**
 * A shift's plan for a date: the weekday's own hours, else the season's,
 * else the shift's. A shorter day needs its own planned hours for a full
 * day and half of them for a half day; normal days keep the shift's.
 */
export function dayPlan(shift: ShiftDefinition, date: string): ShiftRule {
  const wd = shift.week[weekdayOf(date)] ?? { working: true };
  const season = seasonOn(shift.seasons, date);
  const own = wd.start && wd.end && clockMinutes(wd.start) !== null && clockMinutes(wd.end) !== null;
  const start = own ? wd.start! : season ? season.start : shift.start;
  const end = own ? wd.end! : season ? season.end : shift.end;
  const flexible = shift.kind === "flexible";
  const planned = plannedMinutes(start, end, shift.breakMinutes);
  // Flexible: the hours are a window; the full / half day stay as set.
  const full = flexible ? shift.fullDayMinutes : Math.min(shift.fullDayMinutes, planned);
  const half = flexible ? shift.halfDayMinutes : Math.min(shift.halfDayMinutes, Math.max(1, Math.floor(planned / 2)));
  return {
    id: shift.id,
    code: shift.code,
    name: shift.name,
    start,
    end,
    breakMinutes: shift.breakMinutes,
    graceMinutes: shift.graceMinutes,
    fullDayMinutes: full,
    halfDayMinutes: Math.min(half, full),
    otMinimumMinutes: shift.otMinimumMinutes,
    off: !wd.working,
    flexible,
    season: own ? null : season?.name ?? null,
  };
}

/** What decides an employee's shift on a day. */
export interface ShiftChoice {
  /** A roster entry for the day: a shift (worked, even on a usual off day) or OFF. */
  roster?: { shiftId: string | null; off: boolean } | null;
  /** The employee's dated assignments (to = null: ongoing). */
  assignments: readonly { shiftId: string; from: string; to: string | null }[];
  branchDefaultId: string | null;
  companyDefaultId: string | null;
}

/**
 * The shift for an employee-day and where it came from: roster day →
 * dated assignment → branch default → company default. A rostered shift is
 * worked even on its usual off day; a rostered OFF is a weekly off.
 */
export function shiftForDay(date: string, choice: ShiftChoice, shifts: ReadonlyMap<string, ShiftDefinition>): { plan: ShiftRule; source: ShiftSource; shiftId: string | null } {
  const assigned = choice.assignments.find((a) => a.from <= date && (!a.to || a.to >= date) && shifts.has(a.shiftId));
  const usual: { id: string | null; source: ShiftSource } = assigned
    ? { id: assigned.shiftId, source: "assignment" }
    : choice.branchDefaultId && shifts.has(choice.branchDefaultId)
      ? { id: choice.branchDefaultId, source: "branch" }
      : { id: choice.companyDefaultId && shifts.has(choice.companyDefaultId) ? choice.companyDefaultId : null, source: "company" };
  const planOf = (id: string | null) => (id ? dayPlan(shifts.get(id)!, date) : { ...DEFAULT_SHIFT, off: weekdayOf(date) === 6 });
  const r = choice.roster;
  if (r?.off) return { plan: { ...planOf(usual.id), off: true }, source: "roster", shiftId: usual.id };
  if (r?.shiftId && shifts.has(r.shiftId)) return { plan: { ...planOf(r.shiftId), off: false }, source: "roster", shiftId: r.shiftId };
  return { plan: planOf(usual.id), source: usual.source, shiftId: usual.id };
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

/**
 * Roster days from a rotation: the shifts in order, each for `everyDays`
 * days, from `from` to `to`, starting with shift number `startAt` (0-based).
 * "OFF" in the list is a day off.
 */
export function rotate(p: { shiftIds: readonly string[]; everyDays: number; from: string; to: string; startAt?: number }): { date: string; shiftId: string | null; off: boolean }[] {
  const out: { date: string; shiftId: string | null; off: boolean }[] = [];
  if (!p.shiftIds.length || p.everyDays < 1 || p.to < p.from) return out;
  let i = 0;
  for (let d = p.from; d <= p.to && out.length < MAX_ROTATION_DAYS; d = addDays(d)) {
    const id = p.shiftIds[(Math.floor(i / p.everyDays) + (p.startAt ?? 0)) % p.shiftIds.length];
    out.push(id === "OFF" ? { date: d, shiftId: null, off: true } : { date: d, shiftId: id, off: false });
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Checking a shift
// ---------------------------------------------------------------------------

export interface ShiftInput {
  code: string;
  name: string;
  color: ShiftColor;
  kind: ShiftKind;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  otMinimumMinutes: number;
  week: ShiftWeekDay[];
  seasons: ShiftSeason[];
}

const time = (v: unknown) => (typeof v === "string" && clockMinutes(v) !== null ? v.trim().padStart(5, "0") : null);

/** Reads and checks a shift from a form: field errors, and the shift when there are none. */
export function parseShift(raw: unknown): { value: ShiftInput | null; errors: Record<string, string> } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const code = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9][A-Z0-9-]{0,9}$/.test(code)) errors.code = "1–10 letters or numbers (e.g. MOR, N1)";
  if (code === "OFF") errors.code = "OFF is kept for days off on the roster";
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
  if (name.length < 2) errors.name = "Give the shift a name";
  const color = (SHIFT_COLORS as readonly string[]).includes(String(r.color)) ? (r.color as ShiftColor) : "green";
  const kind = (SHIFT_KINDS as readonly string[]).includes(String(r.kind)) ? (r.kind as ShiftKind) : "fixed";
  const start = time(r.start);
  const end = time(r.end);
  if (!start) errors.start = "Use a time like 09:00";
  if (!end) errors.end = "Use a time like 17:00";
  if (start && end && start === end) errors.end = "The end can't be the same as the start";
  const num = (k: string, min: number, max: number) => {
    const n = Number(r[k]);
    if (!Number.isFinite(n) || n < min || n > max || !Number.isInteger(n)) errors[k] = `Between ${min} and ${max} minutes`;
    return n;
  };
  const breakMinutes = num("breakMinutes", 0, 180);
  const graceMinutes = num("graceMinutes", 0, 120);
  const fullDayMinutes = num("fullDayMinutes", 60, 960);
  const halfDayMinutes = num("halfDayMinutes", 30, 720);
  const otMinimumMinutes = num("otMinimumMinutes", 0, 240);
  if (!errors.fullDayMinutes && !errors.halfDayMinutes && halfDayMinutes > fullDayMinutes) errors.halfDayMinutes = "A half day can't be longer than a full day";
  if (start && end && !errors.breakMinutes && spanMinutes(start, end) <= breakMinutes) errors.breakMinutes = "The break is longer than the shift";

  const weekRaw = Array.isArray(r.week) ? r.week : [];
  const week: ShiftWeekDay[] = WEEKDAYS.map((_, i) => {
    const w = (weekRaw[i] && typeof weekRaw[i] === "object" ? weekRaw[i] : {}) as Record<string, unknown>;
    const working = w.working !== false;
    const s = typeof w.start === "string" && w.start ? time(w.start) : null;
    const e = typeof w.end === "string" && w.end ? time(w.end) : null;
    if ((typeof w.start === "string" && w.start && !s) || (typeof w.end === "string" && w.end && !e) || (!!s !== !!e)) errors[`week.${i}`] = "Give both times, or neither";
    else if (s && e && s === e) errors[`week.${i}`] = "The end can't be the same as the start";
    return working ? { working, start: s, end: e } : { working: false, start: null, end: null };
  });
  if (!week.some((w) => w.working)) errors.week = "At least one working day";

  const seasonsRaw = Array.isArray(r.seasons) ? r.seasons : [];
  if (seasonsRaw.length > MAX_SEASONS) errors.seasons = `At most ${MAX_SEASONS} seasons`;
  const seasons: ShiftSeason[] = seasonsRaw.slice(0, MAX_SEASONS).map((x, i) => {
    const v = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const s = {
      name: typeof v.name === "string" ? v.name.trim().slice(0, 30) : "",
      fromMonth: Number(v.fromMonth),
      fromDay: Number(v.fromDay),
      toMonth: Number(v.toMonth),
      toDay: Number(v.toDay),
      start: time(v.start) ?? "",
      end: time(v.end) ?? "",
    };
    const md = (m: number, d: number) => Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1 && d <= 32;
    if (s.name.length < 2) errors[`seasons.${i}`] = "Give the season a name";
    else if (!md(s.fromMonth, s.fromDay) || !md(s.toMonth, s.toDay)) errors[`seasons.${i}`] = "Choose the BS months and days";
    else if (!s.start || !s.end || s.start === s.end) errors[`seasons.${i}`] = "Give the season's hours";
    return s;
  });
  for (let i = 0; i < seasons.length; i++)
    for (let j = i + 1; j < seasons.length; j++) if (seasonsOverlap(seasons[i], seasons[j])) errors[`seasons.${j}`] = `Overlaps ${seasons[i].name}`;

  if (Object.keys(errors).length) return { value: null, errors };
  return {
    value: { code, name, color, kind, start: start!, end: end!, breakMinutes, graceMinutes, fullDayMinutes, halfDayMinutes, otMinimumMinutes, week, seasons },
    errors,
  };
}

function seasonsOverlap(a: ShiftSeason, b: ShiftSeason): boolean {
  const days = (s: ShiftSeason) => {
    const out = new Set<number>();
    for (let m = 1; m <= 12; m++) for (let d = 1; d <= 32; d++) {
      const x = m * 100 + d;
      const from = s.fromMonth * 100 + s.fromDay;
      const to = s.toMonth * 100 + s.toDay;
      if (from <= to ? x >= from && x <= to : x >= from || x <= to) out.add(x);
    }
    return out;
  };
  const da = days(a);
  for (const x of days(b)) if (da.has(x)) return true;
  return false;
}

/** Planned minutes in a normal week (outside seasons). */
export function plannedWeekMinutes(s: Pick<ShiftInput, "start" | "end" | "breakMinutes" | "week" | "kind" | "fullDayMinutes">): number {
  return s.week.reduce((n, w) => {
    if (!w.working) return n;
    if (s.kind === "flexible") return n + s.fullDayMinutes;
    return n + plannedMinutes(w.start && w.end ? w.start : s.start, w.start && w.end ? w.end : s.end, s.breakMinutes);
  }, 0);
}

/** Labour Act reminders for a shift (warnings: the company decides). */
export function shiftWarnings(s: ShiftInput): string[] {
  const out: string[] = [];
  const longDays = s.week
    .map((w, i) => ({ i, w }))
    .filter(({ w }) => w.working && (s.kind === "flexible" ? s.fullDayMinutes : plannedMinutes(w.start && w.end ? w.start : s.start, w.start && w.end ? w.end : s.end, s.breakMinutes)) > DAY_LIMIT_MINUTES)
    .map(({ i }) => SHORT_DAY[i]);
  if (longDays.length) out.push(`More than 8 working hours a day (${longDays.join(", ")}). The Labour Act allows 8; extra hours are overtime.`);
  const week = plannedWeekMinutes(s);
  if (week > WEEK_LIMIT_MINUTES) out.push(`${hours(week)} planned a week. The Labour Act allows 48; extra hours are overtime.`);
  if (s.week.every((w) => w.working)) out.push("No weekly off. The Labour Act gives one weekly holiday; give an off day here or on the roster.");
  const spans = [{ start: s.start, end: s.end }, ...s.week.filter((w) => w.working && w.start && w.end).map((w) => ({ start: w.start!, end: w.end! })), ...s.seasons];
  if (s.kind === "fixed" && s.breakMinutes < 30 && spans.some((x) => spanMinutes(x.start, x.end) > BREAK_AFTER_MINUTES)) {
    out.push("More than 5 hours with less than 30 minutes' break. The Labour Act gives half an hour's rest after 5 hours.");
  }
  const outsideDaylight = spans.some((x) => {
    const a = clockMinutes(x.start) ?? 0;
    const b = clockMinutes(x.end) ?? 0;
    return a < 6 * 60 || b > 19 * 60 || b <= a;
  });
  if (outsideDaylight) out.push("Starts before 06:00 or ends after 19:00. For women working outside daylight the employer must arrange transport (Labour Act).");
  return out;
}

const hours = (m: number) => `${Math.floor(m / 60)}${m % 60 ? `h ${m % 60}m` : " hours"}`;

/** Plain summary of a shift: "09:00–17:00 · Sat, Sun off · Fri 10:00–15:00 · Winter 09:00–16:00". */
export function shiftSummary(s: Pick<ShiftInput, "kind" | "start" | "end" | "week" | "seasons" | "fullDayMinutes">): string {
  const parts = [s.kind === "flexible" ? `Flexible ${hours(s.fullDayMinutes)} between ${s.start}–${s.end}` : `${s.start}–${s.end}`];
  const offs = s.week.map((w, i) => (!w.working ? SHORT_DAY[i] : null)).filter(Boolean);
  parts.push(offs.length ? `${offs.join(", ")} off` : "no weekly off");
  s.week.forEach((w, i) => {
    if (w.working && w.start && w.end) parts.push(`${SHORT_DAY[i]} ${w.start}–${w.end}`);
  });
  for (const x of s.seasons) parts.push(`${x.name} ${x.start}–${x.end} (${x.fromDay} ${BS_MONTHS_EN[x.fromMonth]} – ${x.toDay} ${BS_MONTHS_EN[x.toMonth]})`);
  return parts.join(" · ");
}

/** A week from weekly-off weekday names ("Saturday") and the office hours. */
export function weekFromOffs(offNames: readonly string[]): ShiftWeekDay[] {
  return WEEKDAYS.map((d) => ({ working: !offNames.includes(d), start: null, end: null }));
}
