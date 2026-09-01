import { NepaliDate } from "nepali-date-library";

/**
 * Bikram Sambat (B.S.) calendar — single source of truth.
 *
 * Strict rule: never import `nepali-date-converter` directly anywhere
 * outside this file. All other modules import from here, so we can swap
 * the underlying package without touching the rest of the codebase.
 *
 * Month naming: we use the names the library natively returns, which are
 * the standard English transliterations used in payroll software.
 *   1 = Baisakh, 2 = Jestha, 3 = Asar, 4 = Shrawan, 5 = Bhadra, 6 = Aswin,
 *   7 = Kartik, 8 = Mangsir, 9 = Poush, 10 = Magh, 11 = Falgun, 12 = Chaitra
 *
 * IMPORTANT: This file uses 1-indexed months at the API boundary
 * (1 = Baisakh … 12 = Chaitra) for ergonomic use at the application
 * layer. The library is 0-indexed internally; we normalise in/out.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** English month names, 1-indexed (position 0 unused). */
export const BS_MONTHS_EN = [
  "",
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

/** 0-indexed list of BS English month names for dropdown loops */
export const BS_MONTHS_LIST = BS_MONTHS_EN.slice(1);

/** Nepali month names in Devanagari, 1-indexed. */
export const BS_MONTHS_NP = [
  "",
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भाद्र",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत्र",
] as const;

/** Short month codes, 1-indexed. */
export const BS_MONTHS_SHORT = [
  "",
  "Bai",
  "Jes",
  "Asa",
  "Shr",
  "Bha",
  "Asw",
  "Kar",
  "Man",
  "Pou",
  "Mag",
  "Fal",
  "Cha",
] as const;

/** English weekday names, 0-indexed (0 = Sunday). */
export const BS_DAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Short English weekday names, 0-indexed. */
export const BS_DAYS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** Inclusive upper bound for a BS month's day count (verified per the lib). */
const MAX_DAYS_IN_BS_MONTH = 32;
/** Inclusive lower bound for a BS month's day count (verified per the lib). */
const MIN_DAYS_IN_BS_MONTH = 28;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 1-indexed BS month number (1 = Baisakh … 12 = Chaitra).
 * Used as the primary key for month-related fields throughout the app.
 */
export type BSMonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** A helper to build a `BSMonthNumber` from any int, returning `null` if OOR. */
export function toBSMonthNumber(m: number): BSMonthNumber | null {
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return m as BSMonthNumber;
}

/**
 * A Bikram Sambat date. Month is 1-indexed (1 = Baisakh … 12 = Chaitra).
 */
export interface BSDateObject {
  /** Full BS year, e.g. 2081. */
  year: number;
  /** 1-indexed BS month, 1 = Baisakh … 12 = Chaitra. */
  month: number;
  /** 1-indexed day of the month. */
  day: number;
  /** Resolved English month name. */
  monthName: string;
  /** 0-indexed weekday (0 = Sunday … 6 = Saturday). */
  dayOfWeek: number;
  /** Resolved English weekday name. */
  dayName: string;
}

export interface FiscalYearInfo {
  /** Compact FY string, e.g. "2081/82". */
  fyString: string;
  /** AD Date of the FY start (Shrawan 1 of `bsYear`). */
  startDate: Date;
  /** AD Date of the FY end (Asar last day of `bsYear + 1`). */
  endDate: Date;
  /** The opening BS year of this fiscal year. */
  bsYear: number;
  /** 1–4, derived from the current BS month. */
  quarter: 1 | 2 | 3 | 4;
  /** Current BS month name (English). */
  currentMonth: string;
}

export interface BSMonthDescriptor {
  /** 1-indexed BS month number. */
  monthNumber: number;
  /** Resolved English month name. */
  monthName: string;
  /** The BS year this month belongs to (may differ from opening FY year). */
  bsYear: number;
  /** Human label, e.g. "Shrawan 2081". */
  label: string;
  /** AD Date of the first day of this BS month. */
  startDate: Date;
}

export type BSDateFormat =
  | "long"
  | "short"
  | "month-year"
  | "numeric"
  | "day-month";

/** AD date display formats (mirror the BS variants for symmetry). */
export type ADDateFormat = "iso" | "long" | "short";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve a 1-indexed BS month number to its English name. */
function monthName(month: number): string {
  return BS_MONTHS_EN[month] ?? "Unknown";
}

/** Convert 0-indexed library month → 1-indexed app month. */
function toAppMonth(libraryMonth: number): number {
  return libraryMonth + 1;
}

/** Convert 1-indexed app month → 0-indexed library month. */
function toLibraryMonth(appMonth: number): number {
  return appMonth - 1;
}

/**
 * Cache for {@link getDaysInBSMonth}. Keyed by `${year}-${month}`.
 * Lookup is cheap after the first call.
 */
const DAYS_IN_MONTH_CACHE = new Map<string, number>();

/**
 * Clear the {@link DAYS_IN_MONTH_CACHE}. Exposed for tests; not used at
 * runtime because the day counts are stable historical/astronomical data.
 */
export function clearDaysInBSMonthCache(): void {
  DAYS_IN_MONTH_CACHE.clear();
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/**
 * Convert an AD `Date` (or "now") to a {@link BSDateObject}.
 * The library's `getMonth()` is 0-indexed; we normalise to 1-indexed.
 */
export function adToBS(adDate: Date = new Date()): BSDateObject {
  if (isNaN(adDate.getTime())) {
    return {
      year: 0,
      month: 1,
      day: 1,
      monthName: BS_MONTHS_EN[1],
      dayOfWeek: 0,
      dayName: BS_DAYS_EN[0],
    };
  }
  // nepali-date-library evaluates dates using UTC components (getUTCFullYear, getUTCMonth, getUTCDate).
  // When a Date is created in local timezone (e.g. new Date(2024, 3, 27) at 00:00:00 NPT = 2024-04-26 18:15:00 UTC),
  // passing it directly to NepaliDate causes getUTCDate() to return 26 (one day earlier).
  // Normalizing to UTC midnight using the Date's local calendar year, month, and day ensures exact 1:1 BS translation.
  const normalizedDate = new Date(Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()));
  const n = new NepaliDate(normalizedDate);
  const month = toAppMonth(n.getMonth());
  const dayOfWeek = n.getDay();
  return {
    year: n.getYear(),
    month,
    day: n.getDate(),
    monthName: monthName(month),
    dayOfWeek,
    dayName: BS_DAYS_EN[dayOfWeek] ?? "Sunday",
  };
}

/**
 * Convert a BS date (year, 1-indexed month, day) to an AD `Date`.
 */
export function bsToAD(year: number, month: number, day: number): Date {
  try {
    const n = new NepaliDate(year, toLibraryMonth(month), day);
    const engDate = n.getEnglishDate();
    // Return a local Date representing that calendar day
    return new Date(engDate.getUTCFullYear(), engDate.getUTCMonth(), engDate.getUTCDate());
  } catch {
    return new Date(NaN);
  }
}

/**
 * Parse a BS date string (any of "YYYY-MM-DD", "YYYY/MM/DD", "YYYY MM DD")
 * and return the AD `Date`. Returns `null` if the string is malformed or
 * the date is out of range.
 */
export function bsStringToAD(bsString: string): Date | null {
  const trimmed = bsString.trim();
  // Primary path: strict "YYYY-MM-DD" parsing.
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidBSDate(year, month, day)) return null;
    return bsToAD(year, month, day);
  }
  // Fallback: let the library parse other accepted formats.
  try {
    const n = new NepaliDate(trimmed);
    if (!n || !n.isValid()) return null;
    return n.getEnglishDate();
  } catch {
    return null;
  }
}

/**
 * Convert an AD `Date` to a "YYYY-MM-DD" BS string.
 */
export function adToBSString(adDate: Date): string {
  const bs = adToBS(adDate);
  return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(
    bs.day,
  ).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format an AD `Date` as a BS string using one of the standard formats.
 *
 *   - `long`        → "Mangsir 15, 2081"     (default, used in most places)
 *   - `short`       → "15 MAN 2081"
 *   - `month-year`  → "Mangsir 2081"         (payroll run headers)
 *   - `numeric`     → "2081-08-15"           (IRD exports, file headers)
 *   - `day-month`   → "15 Mangsir"           (upcoming events, holidays)
 */
export function formatBSDate(
  adDate: Date,
  format: BSDateFormat = "long",
): string {
  const bs = adToBS(adDate);
  switch (format) {
    case "long":
      return `${bs.monthName} ${bs.day}, ${bs.year}`;
    case "short":
      return `${bs.day} ${BS_MONTHS_SHORT[bs.month]} ${bs.year}`;
    case "month-year":
      return `${bs.monthName} ${bs.year}`;
    case "numeric":
      return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(
        bs.day,
      ).padStart(2, "0")}`;
    case "day-month":
      return `${bs.day} ${bs.monthName}`;
  }
}

/** Convenience: "Mangsir 15, 2081 · Monday". */
export function formatBSDateWithDay(adDate: Date): string {
  const bs = adToBS(adDate);
  return `${bs.monthName} ${bs.day}, ${bs.year} · ${bs.dayName}`;
}

/** Convenience: "Mangsir 26 · 09:14" (used in payroll run step timestamps). */
export function formatBSDateTime(adDate: Date): string {
  const bs = adToBS(adDate);
  const hh = String(adDate.getHours()).padStart(2, "0");
  const mm = String(adDate.getMinutes()).padStart(2, "0");
  return `${bs.monthName} ${bs.day} · ${hh}:${mm}`;
}

const AD_MONTHS_LONG_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const AD_MONTHS_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Format an AD `Date` as a string. Used when the user has selected
 * the AD display mode via the date format toggle.
 *
 *   - `iso`   → "2024-07-17"   (default, matches BS-numeric compactness)
 *   - `long`  → "July 17, 2024"
 *   - `short` → "17 Jul 2024"
 */
export function formatADDate(
  adDate: Date,
  format: ADDateFormat = "iso",
): string {
  const y = adDate.getFullYear();
  const m = adDate.getMonth() + 1; // 0-indexed
  const d = adDate.getDate();
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  switch (format) {
    case "iso":
      return `${y}-${mm}-${dd}`;
    case "long":
      return `${AD_MONTHS_LONG_EN[m - 1]} ${d}, ${y}`;
    case "short":
      return `${d} ${AD_MONTHS_SHORT_EN[m - 1]} ${y}`;
  }
}

// ---------------------------------------------------------------------------
// Fiscal year
// ---------------------------------------------------------------------------

/**
 * Return complete fiscal-year info for a given AD `Date` (or now).
 * Handles the month-4 boundary: Shrawan = month 4 starts a new FY.
 */
export function getFiscalYear(adDate: Date = new Date()): FiscalYearInfo {
  const bs = adToBS(adDate);
  // If we are in Shrawan(4)–Chaitra(12), the opening BS year is the current
  // one. If we are in Baisakh(1)–Asar(3), we are still in the FY that
  // started the previous Shrawan.
  const fyStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const fyEndYear = fyStartYear + 1;
  const fyString = `${fyStartYear}/${String(fyEndYear).slice(-2).padStart(2, "0")}`;

  // Map calendar month → fiscal-month index (1..12, in fiscal order)
  // Shrawan(4)=1, Bhadra(5)=2, Aswin(6)=3, Kartik(7)=4, Mangsir(8)=5,
  // Poush(9)=6, Magh(10)=7, Falgun(11)=8, Chaitra(12)=9,
  // Baisakh(1)=10, Jestha(2)=11, Asar(3)=12
  const fyMonthIndex = bs.month >= 4 ? bs.month - 3 : bs.month + 9;
  const quarter: 1 | 2 | 3 | 4 =
    fyMonthIndex <= 3 ? 1 : fyMonthIndex <= 6 ? 2 : fyMonthIndex <= 9 ? 3 : 4;

  return {
    fyString,
    startDate: bsToAD(fyStartYear, 4, 1),
    endDate: bsToAD(
      fyEndYear,
      3,
      getDaysInBSMonth(fyEndYear, 3) || 30, // graceful fallback
    ),
    bsYear: fyStartYear,
    quarter,
    currentMonth: bs.monthName,
  };
}

/**
 * All 12 months of a fiscal year in fiscal order
 * (Shrawan → Chaitra → Baisakh → Asar).
 */
export function getFiscalYearMonths(bsYear: number): BSMonthDescriptor[] {
  const out: BSMonthDescriptor[] = [];
  // Opening year months 4..12
  for (let m = 4; m <= 12; m++) {
    out.push({
      monthNumber: m,
      monthName: BS_MONTHS_EN[m],
      bsYear,
      label: `${BS_MONTHS_EN[m]} ${bsYear}`,
      startDate: bsToAD(bsYear, m, 1),
    });
  }
  // Closing year months 1..3
  for (let m = 1; m <= 3; m++) {
    out.push({
      monthNumber: m,
      monthName: BS_MONTHS_EN[m],
      bsYear: bsYear + 1,
      label: `${BS_MONTHS_EN[m]} ${bsYear + 1}`,
      startDate: bsToAD(bsYear + 1, m, 1),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Period utilities
// ---------------------------------------------------------------------------

/** Return the AD start and end dates for a given BS month. */
export function getBSMonthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = bsToAD(year, month, 1);
  const days = getDaysInBSMonth(year, month);
  const end = bsToAD(year, month, days || 30);
  return { start, end };
}

/**
 * Return how many days are in a specific BS month.
 *
 * Implementation: we use the `NepaliDate` class to discover the next
 * month's start in AD space, then count the gap in whole days. This
 * avoids reaching into the library's internal config map (whose named
 * export was unstable under Next.js SSR) and works for every year the
 * library supports (1976..2100 BS).
 *
 * Returns 0 for out-of-range months (so callers can detect "invalid").
 */
export function getDaysInBSMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) return 0;
  if (!Number.isInteger(year)) return 0;

  const cacheKey = `${year}-${month}`;
  const cached = DAYS_IN_MONTH_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  // Compute by AD gap: monthStart = day 1 of (year, month);
  // monthEnd = day 1 of the following month; diff in whole days = days count.
  const monthStart = bsToAD(year, month, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = bsToAD(nextYear, nextMonth, 1);

  const diffMs = monthEnd.getTime() - monthStart.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Sanity bound: BS months are always 28..32 days.
  if (isNaN(days) || days < MIN_DAYS_IN_BS_MONTH || days > MAX_DAYS_IN_BS_MONTH) {
    return 0;
  }

  DAYS_IN_MONTH_CACHE.set(cacheKey, days);
  return days;
}

/** Return every day of a BS month as an array of {@link BSDateObject}. */
export function getBSMonthDays(year: number, month: number): BSDateObject[] {
  const days = getDaysInBSMonth(year, month);
  const out: BSDateObject[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(adToBS(bsToAD(year, month, d)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation & convenience
// ---------------------------------------------------------------------------

/**
 * Return `true` iff the given year/month/day is a real BS date.
 * - month must be 1..12
 * - year must be within the library's range (1976..2100)
 * - day must be 1..getDaysInBSMonth(year, month)
 */
export function isValidBSDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const maxDay = getDaysInBSMonth(year, month);
  if (maxDay === 0) return false; // year out of lookup range
  return day <= maxDay;
}

/** Return `true` iff today (AD now) is in the given BS month. */
export function isCurrentBSMonth(year: number, month: number): boolean {
  const today = adToBS(new Date());
  return today.year === year && today.month === month;
}

/** Convenience: `adToBS(new Date())`. */
export function getTodayBS(): BSDateObject {
  return adToBS(new Date());
}
