/**
 * Holiday engine — pure domain logic for validating, aggregating,
 * and querying holidays.
 *
 * This module is **framework-agnostic** by design:
 *   - No React imports
 *   - No Next.js imports
 *   - No Drizzle / database imports
 *
 * Everything here is a pure function of its inputs. The same
 * engine is used by:
 *   1. The Holiday Setup UI (form validation, KPI card math)
 *   2. The Service layer (re-validates before persisting)
 *   3. Unit tests (Vitest, no DOM)
 *
 * **Date conventions:**
 *   - Holiday dates are BS ISO strings: `"YYYY-MM-DD"` (e.g. `"2081-06-15"`).
 *   - Day count is computed in BS space by counting the inclusive
 *     span from start to end. We can't just diff the two strings
 *     because BS months have variable lengths (28..32 days).
 *     Instead, we convert each BS date to its AD `Date` and count
 *     the AD-day gap. This is mathematically equivalent to "how
 *     many calendar days are between the two BS dates" because BS
 *     is a continuous count of days with no DST or skipped days.
 *
 * **Cross-field rules:**
 *   - Name uniqueness (case-insensitive, trim-aware).
 *   - End date >= start date.
 *   - Branch IDs (when non-empty) must be a subset of the
 *     available branches (passed in by the caller).
 */

import {
  bsStringToAD,
  getDaysInBSMonth,
  isValidBSDate,
} from "@/lib/utils/bs-calendar";
import type { Holiday, HolidayFormData, CategoryFilter } from "@/lib/types/holiday";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface HolidayValidationErrors {
  name?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  branchIds?: string;
  /** Cross-field: end before start. */
  dateOrder?: string;
}

const NAME_MIN = 1;
const NAME_MAX = 60;

function isValidName(n: string): boolean {
  return n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;
}

function isValidBSDateString(s: string): boolean {
  const match = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidBSDate(year, month, day);
}

/**
 * Parse a BS ISO string into {year, month, day}. Returns null if
 * the string is malformed. The components are returned as numbers.
 */
function parseBSDate(s: string): { year: number; month: number; day: number } | null {
  const match = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

// ----- Uniqueness helpers (public) -----------------------------------------

/**
 * Case-insensitive name uniqueness. Used at create and update
 * time. Pass `excludeId` when updating so the holiday's own
 * current name doesn't collide with itself.
 */
export function isNameUnique(args: {
  candidate: string;
  existing: Holiday[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (h) =>
      h.id !== args.excludeId && h.name.trim().toLowerCase() === target,
  );
}

// ----- Main validator ------------------------------------------------------

export interface ValidateHolidayArgs {
  data: HolidayFormData;
  existing: Holiday[];
  excludeId?: string;
  /** Valid branch IDs (used to validate the chosen list). */
  validBranchIds: string[];
}

/**
 * Validate a holiday form payload. Combines per-field rules with
 * cross-field rules:
 *
 *   1. Name required, 1–60 chars, unique.
 *   2. Category must be one of the 5 known categories (form
 *      guarantees this via the dropdown, so we just sanity-check).
 *   3. Start date is a valid BS date string.
 *   4. End date is a valid BS date string.
 *   5. End date >= start date.
 *   6. Branch IDs (when non-empty) must be a subset of
 *      `validBranchIds`.
 *
 * Note: we don't enforce "exactly 1 branch" or "at most N branches"
 * — the design's UX lets the user pick any subset (or none for
 * "All Branches").
 */
export function validateHoliday(
  args: ValidateHolidayArgs,
): HolidayValidationErrors {
  const { data, existing, excludeId, validBranchIds } = args;
  const errors: HolidayValidationErrors = {};

  // 1. Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Holiday Name is required.";
  } else if (!isValidName(data.name)) {
    errors.name = `Holiday Name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  } else if (
    !isNameUnique({ candidate: data.name, existing, excludeId })
  ) {
    errors.name = `A holiday named "${data.name.trim()}" already exists.`;
  }

  // 2. Category
  const knownCategories = [
    "major-festival",
    "cultural-festival",
    "regional-festival",
    "national-holiday",
    "international-holiday",
  ] as const;
  if (!knownCategories.includes(data.category as (typeof knownCategories)[number])) {
    errors.category = "Category is required.";
  }

  // 3. Start date
  if (!data.startDate || !data.startDate.trim()) {
    errors.startDate = "Start date is required.";
  } else if (!isValidBSDateString(data.startDate)) {
    errors.startDate = "Start date must be a valid BS date (YYYY-MM-DD).";
  }

  // 4. End date
  if (!data.endDate || !data.endDate.trim()) {
    errors.endDate = "End date is required.";
  } else if (!isValidBSDateString(data.endDate)) {
    errors.endDate = "End date must be a valid BS date (YYYY-MM-DD).";
  }

  // 5. Cross-field: date order
  if (
    !errors.startDate &&
    !errors.endDate &&
    data.startDate &&
    data.endDate
  ) {
    // Compare the BS strings directly — they sort lexicographically
    // the same way they sort chronologically because BS ISO format
    // is YYYY-MM-DD with month/day zero-padded.
    if (data.startDate > data.endDate) {
      errors.dateOrder = "End date cannot be before start date.";
    }
  }

  // 6. Branch IDs
  if (data.branchIds.length > 0) {
    const invalid = data.branchIds.filter(
      (id) => !validBranchIds.includes(id),
    );
    if (invalid.length > 0) {
      errors.branchIds =
        "One or more selected branches are no longer available.";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Day count
// ---------------------------------------------------------------------------

/**
 * Calculate the inclusive day count for a holiday defined by its
 * BS start / end dates.
 *
 * Algorithm:
 *   1. Convert both BS strings to AD `Date` objects.
 *   2. Round to UTC midnight to dodge timezone drift.
 *   3. Count the inclusive gap in whole days.
 *
 * Falls back to 0 if either date is malformed. Does NOT require the
 * dates to be in order — returns a non-positive number if end < start
 * (caller is expected to validate ordering first).
 */
export function calculateDays(startDate: string, endDate: string): number {
  const start = bsStringToAD(startDate);
  const end = bsStringToAD(endDate);
  if (!start || !end) return 0;
  // Convert to UTC midnight to avoid timezone-induced off-by-one.
  const startUTC = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endUTC = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  const diffMs = endUTC - startUTC;
  // Inclusive day count: if start == end, that's 1 day.
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Total number of BS days the holiday spans. Same as
 * `calculateDays` but returns 0 for negative results.
 */
export function holidayDayCount(h: Pick<Holiday, "startDate" | "endDate">): number {
  const n = calculateDays(h.startDate, h.endDate);
  return n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// Aggregations (used by KPI cards)
// ---------------------------------------------------------------------------

export interface HolidayCounts {
  /** Total number of holidays defined. */
  total: number;
  /** Sum of `holidayDayCount` across every holiday. */
  totalDays: number;
  /** Holidays whose `branchIds` list is empty (i.e. "All Branches"). */
  allBranchCount: number;
}

export function countHolidays(holidays: Holiday[]): HolidayCounts {
  let totalDays = 0;
  let allBranchCount = 0;
  for (const h of holidays) {
    totalDays += holidayDayCount(h);
    if (h.branchIds.length === 0) allBranchCount++;
  }
  return {
    total: holidays.length,
    totalDays,
    allBranchCount,
  };
}

// ---------------------------------------------------------------------------
// Filter + search helpers
// ---------------------------------------------------------------------------

export interface FilterHolidaysArgs {
  holidays: Holiday[];
  /**
   * Free-text query. Matches the holiday name OR the formatted date
   * range (BS ISO), case-insensitive. Empty string returns every
   * holiday. The category label (e.g. "Major Festival") is also
   * considered so a search for "festival" surfaces festivals only.
   */
  search?: string;
  category?: CategoryFilter;
}

/**
 * Apply the search query to a holiday list. Order is preserved (the
 * caller is expected to pass a pre-sorted list).
 */
export function filterHolidays(args: FilterHolidaysArgs): Holiday[] {
  const { holidays, search, category } = args;
  const q = (search ?? "").trim().toLowerCase();

  return holidays.filter((h) => {
    // 1. Category match
    if (category && category !== "all" && h.category !== category) {
      return false;
    }
    
    // 2. Search match
    if (!q) return true;

    const hay = [
      h.name,
      h.category,
      h.category.replace(/-/g, " "),
      h.startDate,
      h.endDate,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort holidays by start date ascending (earliest first). Ties are
 * broken by id for stability. This is the order shown in the
 * design screenshots (Constitution Day in March is the first card,
 * Dashain in June is the third, etc.).
 */
export function sortByStartDate(holidays: Holiday[]): Holiday[] {
  return [...holidays].sort((a, b) => {
    if (a.startDate < b.startDate) return -1;
    if (a.startDate > b.startDate) return 1;
    return a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Generate the next sequential holiday code, e.g. "HOL-001",
 * "HOL-002", …, "HOL-012", "HOL-013".
 *
 * Inspects the existing list and returns `HOL-` zero-padded to 3
 * digits using the max numeric suffix + 1. Falls back to
 * `HOL-001` if no existing holidays.
 */
export function nextHolidayCode(existing: Holiday[]): string {
  let max = 0;
  for (const h of existing) {
    // Note: we use the row id rather than a separate `code` field
    // (unlike pay-heads, holidays don't have a separate code today).
    const m = /^hol-(\d+)$/i.exec(h.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `hol-${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Cross-month helper (re-exported for convenience)
// ---------------------------------------------------------------------------

/**
 * Return the number of days in the given BS month/year. Re-exported
 * from `bs-calendar` so callers can stay within the engine for date
 * math.
 */
export function daysInBSMonth(year: number, month: number): number {
  return getDaysInBSMonth(year, month);
}

// Suppress unused-import lint for `parseBSDate` — it's a documented
// helper but not used by the engine itself today. Keeping it in
// the file because the form layer may want to parse BS strings
// without round-tripping to AD.
void parseBSDate;
