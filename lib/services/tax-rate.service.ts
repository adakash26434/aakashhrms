import * as repository from "@/lib/repositories/tax-rate.repository";
import * as fyRepository from "@/lib/repositories/fiscal-year.repository";
import {
  buildNextSlabDefaults,
  validateSlab,
  validateSlabInLadder,
  type SlabValidationErrors,
} from "@/lib/engines/tax-rate.engine";
import type {
  TaxCategory,
  TaxRateData,
  TaxSlab,
  TaxSlabFormData,
} from "@/lib/types/tax-rate";
import { recordAuditLog } from "@/lib/services/audit.service";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FiscalYearLockedError extends Error {
  constructor(public fiscalYearId: string) {
    super(
      `Fiscal year ${fiscalYearId} is locked — payslips have been generated and no further edits are allowed.`,
    );
    this.name = "FiscalYearLockedError";
  }
}

export class SlabValidationError extends Error {
  constructor(public errors: SlabValidationErrors) {
    super("Slab validation failed");
    this.name = "SlabValidationError";
  }
}

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

function assertFYEditable(fiscalYearId: string, fyList: { id: string; payslipsGenerated: boolean }[]): void {
  const fy = fyList.find((f) => f.id === fiscalYearId);
  if (!fy) {
    throw new Error(`Unknown fiscal year: ${fiscalYearId}`);
  }
  if (fy.payslipsGenerated) {
    throw new FiscalYearLockedError(fiscalYearId);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTaxRateData(): Promise<TaxRateData> {
  const [fiscalYears, slabs] = await Promise.all([
    fyRepository.findAllFiscalYears(),
    repository.findAllSlabs(),
  ]);
  
  const mappedFiscalYears = fiscalYears.map(fy => ({
    id: fy.id,
    label: fy.label,
    isLocked: fy.payslipsGenerated,
  }));

  return { fiscalYears: mappedFiscalYears, slabs };
}

export async function getNewSlabDefaults(args: {
  fiscalYearId: string;
  category: TaxCategory;
}): Promise<{
  amountFrom: number;
  amountTo: number | null;
  ratePercent: number;
  fixedDeduction: number;
}> {
  const ladder = await repository.findSlabsByFYAndCategory({
    fiscalYearId: args.fiscalYearId,
    category: args.category,
  });
  const last = ladder.length > 0 ? ladder[ladder.length - 1] : null;
  return buildNextSlabDefaults(last);
}

// ---------------------------------------------------------------------------
// Writes 
// ---------------------------------------------------------------------------

export async function createSlab(args: {
  fiscalYearId: string;
  category: TaxCategory;
  data: TaxSlabFormData;
}): Promise<TaxSlab> {
  const fyList = await fyRepository.findAllFiscalYears();
  assertFYEditable(args.fiscalYearId, fyList);

  const ladder = await repository.findSlabsByFYAndCategory({
    fiscalYearId: args.fiscalYearId,
    category: args.category,
  });
  const previous = ladder.length > 0 ? ladder[ladder.length - 1] : null;

  const errors = validateSlabInLadder({ candidate: args.data, previous });
  if (Object.keys(errors).length > 0) {
    throw new SlabValidationError(errors);
  }

  const created = await repository.createSlab({
    fiscalYearId: args.fiscalYearId,
    category: args.category,
    amountFrom: args.data.amountFrom,
    amountTo: args.data.amountTo,
    ratePercent: args.data.ratePercent,
    fixedDeduction: args.data.fixedDeduction,
  });

  const recordTitle = `${created.category} Slab (${created.amountFrom.toLocaleString()} - ${created.amountTo ? created.amountTo.toLocaleString() : "Above"}) @ ${created.ratePercent}%`;

  await recordAuditLog({
    action: "ADD",
    module: "TAX_RATES",
    recordId: recordTitle,
    newValues: {
      category: created.category,
      amountFrom: created.amountFrom,
      amountTo: created.amountTo,
      ratePercent: created.ratePercent,
      fixedDeduction: created.fixedDeduction,
    },
  });

  return created;
}

export async function updateSlab(
  id: string,
  patch: TaxSlabFormData,
): Promise<TaxSlab> {
  const allSlabs = await repository.findAllSlabs();
  const existing = allSlabs.find((s) => s.id === id);
  if (!existing) {
    throw new Error(`Slab ${id} not found`);
  }

  const fyList = await fyRepository.findAllFiscalYears();
  assertFYEditable(existing.fiscalYearId, fyList);

  const errors = validateSlab(patch);
  if (Object.keys(errors).length > 0) {
    throw new SlabValidationError(errors);
  }

  const updated = await repository.updateSlab(id, patch);

  const recordTitle = `${existing.category} Slab (${existing.amountFrom.toLocaleString()} - ${existing.amountTo ? existing.amountTo.toLocaleString() : "Above"})`;

  await recordAuditLog({
    action: "EDIT",
    module: "TAX_RATES",
    recordId: recordTitle,
    oldValues: {
      amountFrom: existing.amountFrom,
      amountTo: existing.amountTo,
      ratePercent: existing.ratePercent,
      fixedDeduction: existing.fixedDeduction,
    },
    newValues: {
      amountFrom: updated.amountFrom,
      amountTo: updated.amountTo,
      ratePercent: updated.ratePercent,
      fixedDeduction: updated.fixedDeduction,
    },
  });

  return updated;
}

export async function deleteSlab(id: string): Promise<void> {
  const allSlabs = await repository.findAllSlabs();
  const existing = allSlabs.find((s) => s.id === id);
  if (!existing) {
    throw new Error(`Slab ${id} not found`);
  }

  const fyList = await fyRepository.findAllFiscalYears();
  assertFYEditable(existing.fiscalYearId, fyList);

  await repository.deleteSlab(id);

  const recordTitle = `${existing.category} Slab (${existing.amountFrom.toLocaleString()} - ${existing.amountTo ? existing.amountTo.toLocaleString() : "Above"})`;

  await recordAuditLog({
    action: "DELETE",
    module: "TAX_RATES",
    recordId: recordTitle,
    oldValues: {
      category: existing.category,
      amountFrom: existing.amountFrom,
      amountTo: existing.amountTo,
      ratePercent: existing.ratePercent,
      fixedDeduction: existing.fixedDeduction,
    },
  });
}
