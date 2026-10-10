import { periodFor, shiftPeriod, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import type { WorkingPeriod } from "@/lib/types/payroll-run";

// E1 (4.8b-3): the working period shared by Payroll, Attendance and Reports, chosen in the title
// bar. Kept in a cookie so the server renders the chosen month straight away. Not secret: a
// display preference only; the server validates it and ignores it when the company's pay
// calendar differs.

export const WORKING_PERIOD_KEY = "payroll.workingPeriod";

/** "BS:2083-06" */
export function formatWorkingPeriod(p: WorkingPeriod): string {
  return `${p.calendar}:${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** The cookie's value as a period of the company's calendar, or null when malformed, out of range or of the other calendar. */
export function parseWorkingPeriod(s: string | null | undefined, calendar: PeriodCalendar): WorkingPeriod | null {
  if (!s) return null;
  const m = /^(BS|AD):(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m || m[1] !== calendar) return null;
  const year = Number(m[2]);
  const month = Number(m[3]);
  if (month < 1 || month > 12 || year < 1950 || year > 2200) return null;
  try {
    periodFor(calendar, year, month);
  } catch {
    return null;
  }
  return { calendar, year, month };
}

export function shiftWorkingPeriod(p: WorkingPeriod, delta: number): WorkingPeriod {
  const next = shiftPeriod(periodFor(p.calendar, p.year, p.month), delta);
  return { calendar: p.calendar, year: next.year, month: next.month };
}

/** "Aswin 2083" / "October 2026" */
export function workingPeriodLabel(p: WorkingPeriod): string {
  return periodFor(p.calendar, p.year, p.month).label;
}
