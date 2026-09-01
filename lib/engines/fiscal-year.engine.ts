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

import type { FiscalYear, FiscalYearFormData } from "@/lib/types/fiscal-year";

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
