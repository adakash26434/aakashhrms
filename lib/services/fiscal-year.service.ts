/**
 * Fiscal Year service — business orchestration layer.
 *
 * Mirrors the pattern in `lib/services/tax-rate.service.ts`:
 *   - Calls the repository for IO
 *   - Calls the engine for validation / authorization
 *   - Throws typed errors on the expected failure modes
 *
 * The React client talks to this layer ONLY. The repository and
 * the engine are implementation details.
 */

import * as repository from "@/lib/repositories/fiscal-year.repository";
import {
  isOverlapping,
  validateFiscalYear,
  type FiscalYearValidationErrors,
} from "@/lib/engines/fiscal-year.engine";
import type {
  FiscalYear,
  FiscalYearData,
  FiscalYearFormData,
} from "@/lib/types/fiscal-year";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when editing a fiscal year that has payslips generated. */
export class FiscalYearLockedError extends Error {
  constructor(public fiscalYearId: string) {
    super(
      `Fiscal year ${fiscalYearId} is locked — payslips have been generated and no further edits are allowed.`,
    );
    this.name = "FiscalYearLockedError";
  }
}

/** Thrown when the candidate date range overlaps an existing FY. */
export class FiscalYearOverlapError extends Error {
  constructor() {
    super(
      "The new fiscal year would overlap an existing one. Two fiscal years cannot share any days.",
    );
    this.name = "FiscalYearOverlapError";
  }
}

/** Thrown when the form payload fails engine validation. */
export class FiscalYearValidationError extends Error {
  constructor(public errors: FiscalYearValidationErrors) {
    super("Fiscal year validation failed");
    this.name = "FiscalYearValidationError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getFiscalYearData(): Promise<FiscalYearData> {
  const fiscalYears = await repository.findAllFiscalYears();
  return { fiscalYears };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createFiscalYear(
  payload: FiscalYearFormData,
): Promise<FiscalYear> {
  // 1. Engine validation.
  const errors = validateFiscalYear(payload);
  if (Object.keys(errors).length > 0) {
    throw new FiscalYearValidationError(errors);
  }

  // 2. Uniqueness — cannot overlap any existing FY.
  const all = await repository.findAllFiscalYears();
  if (isOverlapping(payload, all)) {
    throw new FiscalYearOverlapError();
  }

  // 3. Persist.
  return repository.createFiscalYear({
    slug: payload.slug,
    fromMonth: payload.fromMonth,
    toMonth: payload.toMonth,
    startDateAD: payload.startDateAD,
    endDateAD: payload.endDateAD,
  });
}

export async function updateFiscalYear(
  id: string,
  payload: FiscalYearFormData,
): Promise<FiscalYear> {
  // 1. Authorization — must not be locked.
  const existing = await repository.findFiscalYearById(id);
  if (!existing) throw new Error(`Fiscal year ${id} not found`);
  if (existing.payslipsGenerated) {
    throw new FiscalYearLockedError(id);
  }

  // 2. Engine validation.
  const errors = validateFiscalYear(payload);
  if (Object.keys(errors).length > 0) {
    throw new FiscalYearValidationError(errors);
  }

  // 3. Uniqueness — must not overlap any OTHER FY.
  const all = await repository.findAllFiscalYears();
  const others = all.filter((fy) => fy.id !== id);
  if (isOverlapping(payload, others)) {
    throw new FiscalYearOverlapError();
  }

  return repository.updateFiscalYear(id, {
    slug: payload.slug,
    fromMonth: payload.fromMonth,
    toMonth: payload.toMonth,
    startDateAD: payload.startDateAD,
    endDateAD: payload.endDateAD,
  });
}

export async function lockFiscalYear(id: string): Promise<FiscalYear> {
  const existing = await repository.findFiscalYearById(id);
  if (!existing) throw new Error(`Fiscal year ${id} not found`);
  if (existing.payslipsGenerated || existing.status === "Locked") {
    throw new Error(`Fiscal year ${existing.label} is already locked.`);
  }
  return repository.lockFiscalYear(id);
}

export async function deleteFiscalYear(id: string): Promise<void> {
  const existing = await repository.findFiscalYearById(id);
  if (!existing) throw new Error(`Fiscal year ${id} not found`);
  if (existing.payslipsGenerated) {
    throw new FiscalYearLockedError(id);
  }
  return repository.deleteFiscalYear(id);
}

