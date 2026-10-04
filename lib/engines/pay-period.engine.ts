// Attendance and pay months (4.5): one model for Bikram Sambat (BS) months
// (29–32 days) and Gregorian (AD) months (28–31 days). Every day is an AD
// date "YYYY-MM-DD", so both calendars agree on which days a month holds;
// the daily pay rate is salary ÷ the month's days. Pure: no database access.

import { BS_MONTHS_EN, adToBS, bsToAD, getDaysInBSMonth } from "@/lib/utils/bs-calendar";

export type PeriodCalendar = "BS" | "AD";

export interface PayPeriod {
  calendar: PeriodCalendar;
  year: number;
  /** 1–12: Baisakh … Chaitra (BS) or January … December (AD). */
  month: number;
  /** First and last AD dates of the month, "YYYY-MM-DD". */
  start: string;
  end: string;
  days: number;
  /** "Aswin 2083" or "October 2026". */
  label: string;
}

const AD_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
/** A local Date (as bs-calendar returns) as "YYYY-MM-DD". */
const isoOfLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" as a UTC-midnight Date (safe day arithmetic). */
export const utcDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoOfUtc = (d: Date) => d.toISOString().slice(0, 10);

/** The day after (or n days after) an AD date. */
export function addDays(iso: string, n = 1): string {
  const d = utcDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoOfUtc(d);
}

/** The month (BS or AD) with this number; throws for a month outside the calendar's range. */
export function periodFor(calendar: PeriodCalendar, year: number, month: number): PayPeriod {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error(`Not a month: ${year}-${month}`);
  if (calendar === "AD") {
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { calendar, year, month, start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(days)}`, days, label: `${AD_MONTHS[month]} ${year}` };
  }
  const days = getDaysInBSMonth(year, month);
  if (!days) throw new Error(`BS month out of range: ${year}-${month}`);
  return { calendar, year, month, start: isoOfLocal(bsToAD(year, month, 1)), end: isoOfLocal(bsToAD(year, month, days)), days, label: `${BS_MONTHS_EN[month]} ${year}` };
}

/** The month (in that calendar) holding an AD date. */
export function periodContaining(calendar: PeriodCalendar, iso: string): PayPeriod {
  const [y, m, d] = iso.split("-").map(Number);
  if (calendar === "AD") return periodFor("AD", y, m);
  const bs = adToBS(new Date(y, m - 1, d));
  return periodFor("BS", bs.year, bs.month);
}

/** The month before (-1) or after (+1). */
export function shiftPeriod(p: PayPeriod, delta: number): PayPeriod {
  const index = p.year * 12 + (p.month - 1) + delta;
  return periodFor(p.calendar, Math.floor(index / 12), (index % 12) + 1);
}

/** Every AD date of the month, in order. */
export function datesIn(p: Pick<PayPeriod, "start" | "days">): string[] {
  return Array.from({ length: p.days }, (_, i) => addDays(p.start, i));
}

/** Day of the week of an AD date (0 Sunday … 6 Saturday). */
export function weekdayOf(iso: string): number {
  return utcDate(iso).getUTCDay();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The BS day number of an AD date (for register headers). */
export function bsDayOf(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  const bs = adToBS(new Date(y, m - 1, d));
  return { year: bs.year, month: bs.month, day: bs.day };
}
