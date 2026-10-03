// Kit date field (4.2): typed BS or AD dates stored as AD "YYYY-MM-DD".
// Pure conversions live here; the control is components/kit/date-field.tsx.

import { adToBS, bsToAD, getDaysInBSMonth } from "@/lib/utils/bs-calendar";
import { addDays, toIsoDate, toLocalDate } from "@/lib/utils/nepal-time";

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Years the BS calendar library supports; typing is limited to these. */
export const DATE_YEARS = { BS: { min: 1976, max: 2099 }, AD: { min: 1920, max: 2042 } } as const;

/** adToBS throws outside the supported range: never let that reach a render. */
function safeAdToBS(date: Date) {
  if (date.getFullYear() < DATE_YEARS.AD.min || date.getFullYear() > DATE_YEARS.AD.max) return null;
  try {
    const bs = adToBS(date);
    return bs.year > 0 ? bs : null;
  } catch {
    return null;
  }
}

function safeBsToAd(year: number, month: number, day: number): Date | null {
  if (year < DATE_YEARS.BS.min || year > DATE_YEARS.BS.max) return null;
  try {
    const ad = bsToAD(year, month, day);
    return isNaN(ad.getTime()) ? null : ad;
  } catch {
    return null;
  }
}

function safeDaysInBsMonth(year: number, month: number): number {
  try {
    return getDaysInBSMonth(year, month) || 0;
  } catch {
    return 0;
  }
}

/** The stored AD date as the text the user sees: "YYYY/MM/DD" in BS or AD. */
export function isoToDisplay(iso: string | null | undefined, isBS: boolean): string {
  const date = toLocalDate(iso ?? null);
  if (!date) return "";
  if (!isBS) return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  const bs = safeAdToBS(date);
  return bs ? `${bs.year}/${pad(bs.month)}/${pad(bs.day)}` : "";
}

/** A complete calendar day (BS or AD) as the stored AD "YYYY-MM-DD"; null when it is not a real day. */
export function dayToIso(day: CalendarDay, isBS: boolean): string | null {
  if (isBS) {
    if (day.month < 1 || day.month > 12) return null;
    const max = safeDaysInBsMonth(day.year, day.month);
    if (!max || day.day < 1 || day.day > max) return null;
    const ad = safeBsToAd(day.year, day.month, day.day);
    return ad ? toIsoDate(ad) : null;
  }
  if (day.year < DATE_YEARS.AD.min || day.year > DATE_YEARS.AD.max) return null;
  const ad = new Date(day.year, day.month - 1, day.day);
  if (ad.getFullYear() !== day.year || ad.getMonth() !== day.month - 1 || ad.getDate() !== day.day) return null;
  return toIsoDate(ad);
}

/** The stored date as a calendar day in the active calendar. */
export function isoToDay(iso: string | null | undefined, isBS: boolean): CalendarDay | null {
  const date = toLocalDate(iso ?? null);
  if (!date) return null;
  if (!isBS) return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  const bs = safeAdToBS(date);
  return bs ? { year: bs.year, month: bs.month, day: bs.day } : null;
}

/** Moves a stored date by whole days (arrow keys in the calendar). */
export function shiftIsoDays(iso: string, days: number): string {
  const date = toLocalDate(iso);
  return date ? toIsoDate(addDays(date, days)) : iso;
}

/** Same day in the previous / next month, clamped to that month's length (PageUp / PageDown). */
export function shiftIsoMonths(iso: string, months: number, isBS: boolean): string {
  const day = isoToDay(iso, isBS);
  if (!day) return iso;
  const total = day.year * 12 + (day.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const max = isBS ? safeDaysInBsMonth(year, month) || 30 : new Date(year, month, 0).getDate();
  return dayToIso({ year, month, day: Math.min(day.day, max) }, isBS) ?? iso;
}

/** Days in a month of the active calendar and the weekday (0 = Sunday) of its first day. */
export function monthLayout(year: number, month: number, isBS: boolean): { days: number; firstWeekday: number } {
  if (isBS) {
    const days = safeDaysInBsMonth(year, month) || 30;
    const first = safeBsToAd(year, month, 1);
    return { days, firstWeekday: first ? first.getDay() : 0 };
  }
  return { days: new Date(year, month, 0).getDate(), firstWeekday: new Date(year, month - 1, 1).getDay() };
}
