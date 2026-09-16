import {
  getDaysInBSMonth,
  isValidBSDate,
} from "./bs-calendar";

export const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toNepaliNumerals(num: number | string): string {
  return String(num).replace(/\d/g, (d) => NEPALI_DIGITS[Number(d)] ?? d);
}

export function fromNepaliNumerals(val: string): string {
  return val.replace(/[०-९]/g, (d) => String(NEPALI_DIGITS.indexOf(d)));
}

export interface FormatDateInputOptions {
  raw: string;
  prevValue: string;
  isBS: boolean;
  minYear?: number;
  maxYear?: number;
}

export interface FormatDateInputResult {
  formatted: string;
  year: number | null;
  month: number | null;
  day: number | null;
  isValid: boolean;
}

/**
 * Returns the exact maximum number of days in the specified month.
 * - In BS: accurately looks up the Bikram Sambat calendar day count (28 to 32 days).
 * - In AD: accurately computes Gregorian calendar days including leap years (28 to 31 days).
 */
export function getMaxDaysInMonth(
  year: number | null,
  month: number | null,
  isBS: boolean
): number {
  if (!month || month < 1 || month > 12) {
    return isBS ? 32 : 31;
  }
  const fallbackYear = year && year >= 1000 ? year : isBS ? 2081 : 2026;
  if (isBS) {
    const days = getDaysInBSMonth(fallbackYear, month);
    return days > 0 ? days : 32;
  } else {
    // Month is 1-indexed. Day 0 of month+1 is the last day of month.
    return new Date(fallbackYear, month, 0).getDate();
  }
}

/**
 * Intelligent date input formatter and validator for YYYY/MM/DD inputs (BS and AD).
 *
 * Rules:
 * 1. Month strictly restricted between 01 and 12 (never > 12, never 00).
 * 2. Day strictly restricted between 01 and the EXACT maximum days for that year and month.
 * 3. Supports Devanagari numeral conversion (e.g. २०८३ -> 2083).
 * 4. Supports smart auto-slashing on forward typing and smooth deletion on backspace.
 * 5. Handles pasted dates with slashes, hyphens, or single digits (e.g. 2083-5-8 -> 2083/05/08).
 */
export function formatDateInput({
  raw,
  prevValue,
  isBS,
  minYear,
  maxYear,
}: FormatDateInputOptions): FormatDateInputResult {
  const normalized = fromNepaliNumerals(raw);
  const isDeleting = raw.length < prevValue.length;

  // Handle backspacing over a slash cleanly
  let cleanInput = normalized;
  if (
    isDeleting &&
    prevValue.endsWith("/") &&
    normalized === prevValue.slice(0, -1)
  ) {
    cleanInput = normalized.slice(0, -1);
  }

  const allDigits = cleanInput.replace(/\D/g, "").slice(0, 8);
  if (allDigits.length === 0) {
    return { formatted: "", year: null, month: null, day: null, isValid: false };
  }

  // Detect if explicit delimiters (/, -, .) were entered or pasted
  const hasDelimiters = /[/\-.\s]/.test(cleanInput);
  let yearStr = "";
  let monthStr = "";
  let dayStr = "";

  if (hasDelimiters) {
    const segments = cleanInput
      .split(/[/\-.\s]+/)
      .map((s) => s.replace(/\D/g, ""));
    yearStr = segments[0]?.slice(0, 4) || "";
    monthStr = segments[1]?.slice(0, 2) || "";
    dayStr = segments[2]?.slice(0, 2) || "";
  } else {
    yearStr = allDigits.slice(0, 4);
    monthStr = allDigits.slice(4, 6);
    dayStr = allDigits.slice(6, 8);
  }

  let formatted = yearStr;
  const yearNum: number | null =
    yearStr.length === 4 ? Number(yearStr) : null;
  let monthNum: number | null = null;
  let dayNum: number | null = null;

  // Process Month
  if (yearStr.length === 4) {
    if (monthStr.length > 0 || (!isDeleting && allDigits.length >= 4)) {
      formatted += "/";
    }

    if (monthStr.length === 1) {
      const mDigit = Number(monthStr);
      if (!isDeleting && mDigit >= 2 && mDigit <= 9) {
        // Auto-pad single digit 2..9 to 02..09
        monthStr = `0${mDigit}`;
        monthNum = mDigit;
        formatted += monthStr;
        if (!isDeleting) formatted += "/";
      } else {
        formatted += monthStr;
      }
    } else if (monthStr.length === 2) {
      let m = Number(monthStr);
      if (m === 0) m = 1;
      if (m > 12) m = 12; // STRICT CLAMP: month can NEVER exceed 12
      monthNum = m;
      monthStr = String(m).padStart(2, "0");
      formatted += monthStr;
      if (dayStr.length > 0 || (!isDeleting && allDigits.length >= 6)) {
        formatted += "/";
      }
    }
  }

  // Process Day
  if (monthStr.length === 2 && monthNum !== null) {
    const maxDays = getMaxDaysInMonth(yearNum, monthNum, isBS);

    if (dayStr.length === 1) {
      const dDigit = Number(dayStr);
      if (maxDays <= 29 && dDigit >= 3) {
        // In Feb or short month, day cannot start with 3
        dayStr = String(maxDays);
        dayNum = maxDays;
        formatted += dayStr;
      } else if (!isDeleting && dDigit >= 4 && dDigit <= 9) {
        // Auto-pad single digit 4..9 to 04..09
        const clampedD = Math.min(dDigit, maxDays);
        dayStr = String(clampedD).padStart(2, "0");
        dayNum = clampedD;
        formatted += dayStr;
      } else {
        formatted += dayStr;
      }
    } else if (dayStr.length === 2) {
      let d = Number(dayStr);
      if (d === 0) d = 1;
      if (d > maxDays) d = maxDays; // STRICT CLAMP: day can NEVER exceed max days in that month!
      dayNum = d;
      dayStr = String(d).padStart(2, "0");
      formatted += dayStr;
    }
  }

  const isComplete =
    yearStr.length === 4 &&
    monthStr.length === 2 &&
    dayStr.length === 2 &&
    yearNum !== null &&
    monthNum !== null &&
    dayNum !== null;

  const effectiveMinYear = minYear ?? (isBS ? 1976 : 1920);
  const effectiveMaxYear = maxYear ?? (isBS ? 2100 : 2050);

  let isValid = false;
  if (isComplete && yearNum && monthNum && dayNum) {
    if (yearNum < effectiveMinYear || yearNum > effectiveMaxYear) {
      isValid = false;
    } else if (isBS) {
      isValid = isValidBSDate(yearNum, monthNum, dayNum);
    } else {
      const adDate = new Date(yearNum, monthNum - 1, dayNum);
      isValid =
        !isNaN(adDate.getTime()) &&
        adDate.getFullYear() === yearNum &&
        adDate.getMonth() === monthNum - 1 &&
        adDate.getDate() === dayNum;
    }
  }

  return {
    formatted,
    year: yearNum,
    month: monthNum,
    day: dayNum,
    isValid,
  };
}
