/**
 * Shift allowance (4.12e) — pure rules.
 *
 * A shift may carry an allowance for each day worked on it (a night shift's "per night"). A day
 * counts by the part of it worked on its shift: a full day or a day on duty 1, a half day ½ (a
 * half-day leave takes its half off), nothing for leave, absence or a missing punch. Work on a
 * holiday or a weekly off counts by its hours: a full day's hours 1, a half day's ½. The month's
 * allowance is the days worked × the shift's rate, per shift, to the paisa. The attendance month
 * freezes it when it closes (its days and rates in the summary); payroll pays it on the
 * SHIFT_ALLOWANCE system head (taxable). Tests: tests/shift-allowance.engine.test.ts.
 */

import type { DayResult, ShiftAllowanceLine, ShiftDefinition } from "@/lib/types/attendance";

/** The most a shift's allowance may be for one day (NPR). */
export const ALLOWANCE_MAX = 100_000;

/** What the allowance needs to know about a shift. */
export interface ShiftPay {
  code: string;
  name: string;
  /** NPR for each day worked. */
  rate: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
}

/** The shifts that carry an allowance, by id (archived ones too: days in the month may use them). */
export function shiftPayOf(shifts: Iterable<Pick<ShiftDefinition, "id" | "code" | "name" | "allowancePerDay" | "fullDayMinutes" | "halfDayMinutes">>): Map<string, ShiftPay> {
  const out = new Map<string, ShiftPay>();
  for (const s of shifts) {
    if (s.allowancePerDay > 0) out.set(s.id, { code: s.code, name: s.name, rate: s.allowancePerDay, fullDayMinutes: s.fullDayMinutes, halfDayMinutes: s.halfDayMinutes });
  }
  return out;
}

const toHalf = (n: number) => Math.max(0, Math.min(1, Math.round(n * 2) / 2));

/** The part of a day worked on its shift: 1, ½ or 0. */
export function workedPart(
  day: Pick<DayResult, "dayType" | "payable" | "leavePaidDays" | "workMinutes">,
  shift: Pick<ShiftPay, "fullDayMinutes" | "halfDayMinutes">
): number {
  switch (day.dayType) {
    case "present":
    case "half_day":
    case "on_duty":
      // The paid part of the day less the part paid as leave (a half-day leave).
      return toHalf(day.payable - day.leavePaidDays);
    case "holiday":
    case "weekly_off":
      return day.workMinutes >= shift.fullDayMinutes ? 1 : day.workMinutes >= shift.halfDayMinutes ? 0.5 : 0;
    default:
      return 0;
  }
}

/** Paisa, half up (amounts are multiples of half a paisa at most: days are halves, rates paisa). */
const paisa = (halves: number, rate: number) => Math.round((halves * Math.round(rate * 100)) / 2);

/** A month's days as one line per shift that carries an allowance (none: an empty list). */
export function shiftAllowanceLines(
  days: readonly Pick<DayResult, "dayType" | "payable" | "leavePaidDays" | "workMinutes" | "shift">[],
  pay: ReadonlyMap<string, ShiftPay>
): ShiftAllowanceLine[] {
  if (!pay.size) return [];
  const halves = new Map<string, number>();
  for (const d of days) {
    const id = d.shift?.id;
    const p = id ? pay.get(id) : undefined;
    if (!id || !p) continue;
    const part = workedPart(d, p);
    if (part > 0) halves.set(id, (halves.get(id) ?? 0) + Math.round(part * 2));
  }
  return [...halves]
    .map(([shiftId, h]) => {
      const p = pay.get(shiftId)!;
      return { shiftId, code: p.code, name: p.name, days: h / 2, rate: p.rate, amount: paisa(h, p.rate) / 100 };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** The month's allowance (NPR, to the paisa); summaries stored before 4.12e have no lines. */
export function shiftAllowanceTotal(lines: readonly Pick<ShiftAllowanceLine, "amount">[] | null | undefined): number {
  return (lines ?? []).reduce((n, l) => n + Math.round(l.amount * 100), 0) / 100;
}

/** Days worked on shifts with an allowance. */
export function shiftAllowanceDays(lines: readonly Pick<ShiftAllowanceLine, "days">[] | null | undefined): number {
  return (lines ?? []).reduce((n, l) => n + l.days, 0);
}

const npr = (n: number) => `NPR ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Days with halves: "½ day", "1 day", "12½ days". */
export function daysText(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5 ? "½" : "";
  return `${whole || !half ? whole : ""}${half} ${n > 0 && n <= 1 ? "day" : "days"}`;
}

/** The month in words: "N1 12½ days × NPR 300 = NPR 3,750". */
export function describeShiftAllowance(lines: readonly ShiftAllowanceLine[]): string {
  if (!lines.length) return "No shift allowance";
  return lines.map((l) => `${l.code} ${daysText(l.days)} × ${npr(l.rate)} = ${npr(l.amount)}`).join(" · ");
}

/** A rate a day for the shift list: "NPR 300 a day", or null for none. */
export const allowanceRate = (rate: number): string | null => (rate > 0 ? `${npr(rate)} a day` : null);
