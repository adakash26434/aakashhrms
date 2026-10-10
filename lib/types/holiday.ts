/**
 * Holidays — domain and screen types.
 *
 * A holiday runs from one day to another (stored in BS, with the AD days
 * beside them), for every branch or chosen branches, and for everyone or
 * women only (International Women's Day). Attendance and leave read it
 * through `holidayApplies` (lib/engines/holiday.engine.ts).
 */

/** The categories observed in Nepal payroll. */
export const HOLIDAY_CATEGORIES = ["major-festival", "cultural-festival", "regional-festival", "national-holiday", "international-holiday"] as const;

export type HolidayCategory = (typeof HOLIDAY_CATEGORIES)[number];

/** Who gets the day off. */
export type HolidayAppliesTo = "everyone" | "women";

export interface Holiday {
  id: string;
  name: string;
  category: HolidayCategory;
  /** Inclusive start, BS "YYYY-MM-DD". */
  startDate: string;
  /** Inclusive end, BS "YYYY-MM-DD". */
  endDate: string;
  /** The same days in AD (local-midnight timestamps). */
  startDateAD: Date;
  endDateAD: Date;
  appliesTo: HolidayAppliesTo;
  /** Empty: every branch. */
  branchIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** The holiday window: AD dates (the date fields store AD and show BS first). */
export interface HolidayForm {
  name: string;
  category: HolidayCategory;
  from: string;
  to: string;
  appliesTo: HolidayAppliesTo;
  /** Empty: every branch. */
  branchIds: string[];
}

export type HolidayFormErrors = Partial<Record<keyof HolidayForm, string>>;

export interface HolidayRow {
  id: string;
  name: string;
  category: HolidayCategory;
  categoryLabel: string;
  /** BS "YYYY-MM-DD". */
  fromBs: string;
  toBs: string;
  /** AD "YYYY-MM-DD". */
  fromAd: string;
  toAd: string;
  days: number;
  /** Opening BS year of its fiscal year (Shrawan–Asar). */
  fiscalYear: number;
  appliesTo: HolidayAppliesTo;
  /** "All branches" or the branches' names. */
  branches: string;
  /** Why the user can't change or delete it (null: they can). */
  locked: string | null;
  form: HolidayForm;
}

export interface HolidaysPage {
  holidays: HolidayRow[];
  /** The branches the user may give a holiday to (all of them for a company-wide role). */
  branches: { id: string; name: string }[];
  /** Fiscal years to filter by, newest first, with the current one. */
  fiscalYears: { year: number; label: string }[];
  currentFiscalYear: number;
  /** A company-wide role: may give a holiday to every branch. */
  companyWide: boolean;
  /** Holidays → Add / Edit / Delete (buttons only; the server checks scope and closed months). */
  can: { add: boolean; edit: boolean; delete: boolean };
}

/** What a save says besides "saved". */
export interface HolidaySaveResult {
  id: string;
  name: string;
  /** Approved leave inside the dates: its days were counted before this holiday. */
  leaveInside: number;
}
