/**
 * Fiscal Year engine — pure domain logic.
 *
 * Framework-agnostic (no React, no DB, no Next.js). Used by:
 *   1. The Fiscal Year Setup UI (form validation, canEdit checks)
 *   2. The service layer (re-validates before persisting)
 *   3. Unit tests (Vitest, no DOM)
 *
 * The rules implemented here come from the architecture doc
 * section 4.2 (`fiscal_years` schema) and section 6.x (the
 * Bikram Sambat fiscal year runs Shrawan → Asar).
 */

import type { FiscalYear, FiscalYearFormData, FiscalYearState } from "@/lib/types/fiscal-year";
import { BS_MONTHS_EN, bsToAD, getDaysInBSMonth } from "@/lib/utils/bs-calendar";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface FiscalYearValidationErrors {
  label?: string;
  slug?: string;
  fromMonth?: string;
  toMonth?: string;
  startDateAD?: string;
  endDateAD?: string;
  crossField?: string;
}

/**
 * Per-field validation. The cross-ladder rule ("dates must be
 * contiguous and ordered") is checked here too.
 */
export function validateFiscalYear(
  values: FiscalYearFormData,
): FiscalYearValidationErrors {
  const errors: FiscalYearValidationErrors = {};

  if (!values.label.trim()) {
    errors.label = "Label is required.";
  }

  if (!values.slug.trim()) {
    errors.slug = "Slug is required.";
  } else if (!/^[a-z0-9-]+$/.test(values.slug)) {
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens only.";
  }

  if (
    !(values.startDateAD instanceof Date) ||
    isNaN(values.startDateAD.getTime())
  ) {
    errors.startDateAD = "Start date is required.";
  }
  if (
    !(values.endDateAD instanceof Date) ||
    isNaN(values.endDateAD.getTime())
  ) {
    errors.endDateAD = "End date is required.";
  }

  if (
    values.startDateAD instanceof Date &&
    !isNaN(values.startDateAD.getTime()) &&
    values.endDateAD instanceof Date &&
    !isNaN(values.endDateAD.getTime()) &&
    values.endDateAD.getTime() <= values.startDateAD.getTime()
  ) {
    errors.crossField = "End date must be after the start date.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Can the user edit/delete this fiscal year? Returns false once
 * payslips have been generated for any period inside it (per the
 * legacy Excel sheet's "Edit and Delete not allowed after
 * payslip generate for the period" rule).
 */
export function canEdit(fy: FiscalYear): boolean {
  return !fy.payslipsGenerated;
}

// ---------------------------------------------------------------------------
// Uniqueness
// ---------------------------------------------------------------------------

/**
 * Check whether a candidate fiscal year would collide with an
 * existing one. Used at create-time to prevent two FYs from
 * sharing the same opening year. The comparison is on the
 * opening month: the first day of `startDateAD` in the BS
 * calendar of the candidate must not fall inside an existing FY's
 * [startDateAD, endDateAD] range.
 *
 * `existing` is the list of all other FYs (excluding the one
 * being edited, if any — caller's responsibility to filter).
 */
export function isOverlapping(
  candidate: FiscalYearFormData,
  existing: FiscalYear[],
): boolean {
  const cStart = candidate.startDateAD.getTime();
  const cEnd = candidate.endDateAD.getTime();
  for (const fy of existing) {
    const s = fy.startDateAD.getTime();
    const e = fy.endDateAD.getTime();
    // Overlap when [cStart, cEnd] intersects [s, e].
    if (cStart <= e && cEnd >= s) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

/**
 * Format a fiscal-year label using the BS doc convention.
 * Example: `formatFiscalYearLabel(2081)` → `"FY 2081/82"`.
 *
 * Moved here from `lib/types/fiscal-year.ts` so the engine owns
 * all label/domain formatting in one place. The types file now
 * re-exports it for backward-compat.
 */
export function formatFiscalYearLabel(bsOpeningYear: number): string {
  const end = bsOpeningYear + 1;
  return `FY ${bsOpeningYear}/${String(end).slice(-2).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 4.12: a Nepali fiscal year from its opening BS year, and its life cycle
// (current → closed → reopened with a reason). Pure; tests/fiscal-year.engine.test.ts.
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export interface FiscalYearDates {
  /** "FY 2084/85" */
  label: string;
  /** "fy-2084-85" */
  slug: string;
  /** BS "2084-04-01" (Shrawan 1) and the last day of Asar of the next year. */
  startBS: string;
  endBS: string;
  /** The same days in AD, "YYYY-MM-DD". */
  startAD: string;
  endAD: string;
  fromMonth: 4;
  toMonth: 3;
}

/**
 * The fiscal year opening in BS year `bsYear`: Shrawan 1 to the last day of
 * Asar of the next year (Income Tax Act). Null outside the BS calendar the
 * app carries.
 */
export function fiscalYearDates(bsYear: number): FiscalYearDates | null {
  if (!Number.isInteger(bsYear) || bsYear < 2000 || bsYear > 2098) return null;
  const lastDay = getDaysInBSMonth(bsYear + 1, 3);
  if (!lastDay) return null;
  const start = bsToAD(bsYear, 4, 1);
  const end = bsToAD(bsYear + 1, 3, lastDay);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    label: formatFiscalYearLabel(bsYear),
    slug: `fy-${bsYear}-${String(bsYear + 1).slice(-2)}`,
    startBS: `${bsYear}-04-01`,
    endBS: `${bsYear + 1}-03-${pad2(lastDay)}`,
    startAD: isoOf(start),
    endAD: isoOf(end),
    fromMonth: 4,
    toMonth: 3,
  };
}

/** The opening BS year of a stored fiscal year ("2083-04-01" → 2083). */
export const openingYearOf = (fy: { startDateBS: string }): number | null => {
  const y = Number(String(fy.startDateBS).slice(0, 4));
  return Number.isInteger(y) && y > 1900 ? y : null;
};

/** The opening BS year of the fiscal year a BS month belongs to: Shrawan (4) opens it, Asar (3) ends it. */
export const fiscalOpeningYearOf = (bsYear: number, bsMonth: number): number => (bsMonth >= 4 ? bsYear : bsYear - 1);

/** The year to offer for a new fiscal year: after the newest one, else the one holding today. */
export function nextOpeningYear(years: readonly { startDateBS: string }[], today: { year: number; month: number }): number {
  const newest = Math.max(0, ...years.map((y) => openingYearOf(y) ?? 0));
  if (newest) return newest + 1;
  return fiscalOpeningYearOf(today.year, today.month);
}

/**
 * Why a pay month can't be paid (null: it can). A pay run belongs to the
 * fiscal year its month falls in — never simply the current one — so Asar's
 * run made after the next year is current still reconciles its own year. The
 * year needs its Individual tax ladder (every category falls back to it), or
 * the run would withhold no tax at all.
 */
export function payMonthYearProblem(fy: { label: string; status: string; hasTaxSlabs: boolean } | null, bsYear: number, bsMonth: number): string | null {
  const month = `${BS_MONTHS_EN[bsMonth] ?? `Month ${bsMonth}`} ${bsYear}`;
  if (!fy) return `No fiscal year covers ${month}. Add ${formatFiscalYearLabel(fiscalOpeningYearOf(bsYear, bsMonth))} under Setup → Fiscal years first.`;
  if (fy.status === "Locked") return `${fy.label} is closed. Reopen it under Setup → Fiscal years to pay ${month}.`;
  if (!fy.hasTaxSlabs) return `${fy.label} has no tax slabs yet. Set its Individual ladder under Setup → Tax slabs before paying ${month}.`;
  return null;
}

export const FISCAL_YEAR_STATE_LABEL: Record<FiscalYearState, string> = {
  current: "Current",
  upcoming: "Upcoming",
  past: "Past",
  closed: "Closed",
};

/** How a year stands: the current one, closed, or by its dates against today. */
export function fiscalYearState(fy: { status: string; startAD: string; endAD: string }, today: string): FiscalYearState {
  if (fy.status === "Locked") return "closed";
  if (fy.status === "Active") return "current";
  return fy.startAD > today ? "upcoming" : "past";
}

export interface FiscalYearFacts {
  status: string;
  startAD: string;
  endAD: string;
  /** What uses the year ("3 pay runs", "120 leave ledger lines"…); its own tax slabs don't count. */
  inUse: string[];
  /** Pay runs of the year that are not locked yet. */
  openRuns: number;
}

/** Why the year can't be made current (null: it can). */
export function cannotMakeCurrent(fy: Pick<FiscalYearFacts, "status">): string | null {
  if (fy.status === "Active") return "This is already the current fiscal year.";
  if (fy.status === "Locked") return "A closed year can't be made current. Reopen it first.";
  return null;
}

/** Why the year can't be closed (null: it can): never the current year, never before it ends, never with pay runs still open. */
export function cannotClose(fy: FiscalYearFacts, today: string): string | null {
  if (fy.status === "Locked") return "This year is already closed.";
  if (fy.status === "Active") return "The current year can't be closed. Make the next fiscal year current first.";
  if (fy.endAD >= today) return "A year is closed after it ends.";
  if (fy.openRuns > 0) return `${fy.openRuns} pay run${fy.openRuns === 1 ? " of this year is" : "s of this year are"} not locked yet. Lock or delete ${fy.openRuns === 1 ? "it" : "them"} first.`;
  return null;
}

export function cannotReopen(fy: Pick<FiscalYearFacts, "status">): string | null {
  return fy.status === "Locked" ? null : "Only a closed year is reopened.";
}

/** Only a year nothing uses yet (its own tax slabs go with it). */
export function cannotDelete(fy: FiscalYearFacts): string | null {
  if (fy.status === "Active") return "The current fiscal year can't be deleted.";
  if (fy.status === "Locked") return "A closed fiscal year can't be deleted.";
  if (fy.inUse.length) return `This year is in use (${fy.inUse.join(", ")}), so it stays.`;
  return null;
}

export const REOPEN_REASON_MIN = 10;

export function validateReopenReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < REOPEN_REASON_MIN) return `Say why the year is reopened (at least ${REOPEN_REASON_MIN} characters).`;
  if (r.length > 500) return "Keep the reason under 500 characters.";
  return null;
}
