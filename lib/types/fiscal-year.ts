/**
 * A Bikram Sambat (B.S.) fiscal year.
 *
 * The Nepali fiscal year runs from Shrawan (BS month 4) to Asar
 * (BS month 3 of the following year). For example, FY 2081/82 covers
 * Shrawan 2081 through Asar 2082.
 *
 * Storage follows the **BS Golden Rule**:
 *   - `startDateAD` / `endDateAD` are real JS `Date` objects (AD)
 *   - `startDateBS` / `endDateBS` are pre-computed "YYYY-MM-DD" strings
 *     derived from the AD date via `adToBSString()` — these are display
 *     snapshots, not the source of truth.
 *
 * Months on a fiscal year are stored as **1-indexed numbers** so the
 * fiscal cycle can be validated programmatically:
 *   1=Baisakh, 2=Jestha, 3=Asar, 4=Shrawan, …, 12=Chaitra
 */

import type { BSMonthNumber } from "@/lib/utils/bs-calendar";

export type { BSMonthNumber } from "@/lib/utils/bs-calendar";

export type FiscalYearStatus = "Active" | "Inactive" | "Locked";

export interface FiscalYear {
  id: string;
  /** Display label, e.g. "FY 2081/82" (per BS doc convention). */
  label: string;
  /** URL-safe identifier, e.g. "fy-2081-82". */
  slug: string;
  /** Opening BS month of the FY (typically 4 = Shrawan). */
  fromMonth: BSMonthNumber;
  /** Closing BS month of the FY (typically 3 = Asar). */
  toMonth: BSMonthNumber;
  /** Source of truth: AD Date of the first day of the FY (Shrawan 1). */
  startDateAD: Date;
  /** Source of truth: AD Date of the last day of the FY (Asar last day). */
  endDateAD: Date;
  /** Display snapshot: BS "YYYY-MM-DD" of the first day. */
  startDateBS: string;
  /** Display snapshot: BS "YYYY-MM-DD" of the last day. */
  endDateBS: string;
  status: FiscalYearStatus;
  /** Once true, edit and delete actions are disabled unless unlocked. */
  payslipsGenerated: boolean;
}

/**
 * Subset of `FiscalYear` used by the create/edit form. `id`
 * and `payslipsGenerated` are managed by the system.
 */
export interface FiscalYearFormData {
  label: string;
  slug: string;
  fromMonth: BSMonthNumber;
  toMonth: BSMonthNumber;
  /** AD Date of the first day — we store AD per the Golden Rule. */
  startDateAD: Date;
  /** AD Date of the last day. */
  endDateAD: Date;
  /** Status: Active or Inactive */
  status?: FiscalYearStatus;
}

/**
 * Format a fiscal-year label using the BS doc convention.
 * Example: `formatFiscalYearLabel(2081)` → `"FY 2081/82"`.
 */
export function formatFiscalYearLabel(bsOpeningYear: number): string {
  const end = bsOpeningYear + 1;
  return `FY ${bsOpeningYear}/${String(end).slice(-2).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 4.12: the Fiscal years screen
// ---------------------------------------------------------------------------

export type FiscalYearState = "current" | "upcoming" | "past" | "closed";

export interface FiscalYearRow {
  id: string;
  label: string;
  /** BS and AD "YYYY-MM-DD". */
  startBS: string;
  endBS: string;
  startAD: string;
  endAD: string;
  status: FiscalYearStatus;
  state: FiscalYearState;
  /** What uses the year ("3 pay runs"…), its own tax slabs aside. */
  inUse: string[];
  openRuns: number;
  /** Tax slab bands per category. */
  slabs: Record<string, number>;
  /** Why each move is not possible now (null: it is). */
  blocked: { makeCurrent: string | null; close: string | null; reopen: string | null; delete: string | null };
}

export interface FiscalYearsPage {
  years: FiscalYearRow[];
  /** AD "YYYY-MM-DD", Nepal date. */
  today: string;
  /** The opening BS year a new fiscal year would have. */
  nextYear: number;
  /** Fiscal year → Add (new year), Edit (make current, delete) and Lock (close, reopen): buttons only. */
  can: { add: boolean; edit: boolean; lock: boolean };
}
