import * as repository from "@/lib/repositories/holiday.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as fyRepository from "@/lib/repositories/fiscal-year.repository";
import { sortByStartDate, validateHoliday, type HolidayValidationErrors } from "@/lib/engines/holiday.engine";
import type { Holiday, HolidayData, HolidayFormData } from "@/lib/types/holiday";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HolidayValidationError extends Error {
  constructor(public errors: HolidayValidationErrors) {
    super("Holiday validation failed");
    this.name = "HolidayValidationError";
  }
}

export class HolidayNotFoundError extends Error {
  constructor(public id: string) {
    super(`Holiday ${id} not found`);
    this.name = "HolidayNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getHolidayData(): Promise<HolidayData> {
  const [holidays, branches, fiscalYears] = await Promise.all([
    repository.findAllHolidays(),
    branchRepository.findAllBranches(),
    fyRepository.findAllFiscalYears(),
  ]);
  const sorted = sortByStartDate(holidays);
  
  const mappedFiscalYears = fiscalYears.map(fy => ({
    id: fy.id,
    label: fy.label,
    isLocked: fy.payslipsGenerated,
  }));

  return {
    fiscalYears: mappedFiscalYears,
    holidays: sorted,
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
  };
}

export async function getBranches(): Promise<Array<{ id: string; name: string }>> {
  const branches = await branchRepository.findAllBranches();
  return branches.map((b) => ({ id: b.id, name: b.name }));
}

// ---------------------------------------------------------------------------
// Input shaping
// ---------------------------------------------------------------------------

// We do NOT add AD dates here. We let the repository calculate them securely.
function toWriteInput(data: HolidayFormData) {
  return {
    name: data.name,
    category: data.category,
    startDate: data.startDate,
    endDate: data.endDate,
    branchIds: Array.isArray(data.branchIds) ? data.branchIds : [],
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createHoliday(data: HolidayFormData): Promise<Holiday> {
  const existing = await repository.findAllHolidays();
  const allBranches = await branchRepository.findAllBranches();
  const errors = validateHoliday({
    data,
    existing,
    validBranchIds: allBranches.map((b) => b.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new HolidayValidationError(errors);
  }
  return repository.createHoliday(toWriteInput(data));
}

export async function updateHoliday(
  id: string,
  data: HolidayFormData,
): Promise<Holiday> {
  const existingAll = await repository.findAllHolidays();
  const existing = existingAll.find((h) => h.id === id);
  if (!existing) {
    throw new HolidayNotFoundError(id);
  }

  const allBranches = await branchRepository.findAllBranches();
  const errors = validateHoliday({
    data,
    existing: existingAll,
    excludeId: id,
    validBranchIds: allBranches.map((b) => b.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new HolidayValidationError(errors);
  }
  return repository.updateHoliday(id, toWriteInput(data));
}

export async function deleteHoliday(id: string): Promise<void> {
  const existing = await repository.findHolidayById(id);
  if (!existing) {
    throw new HolidayNotFoundError(id);
  }
  return repository.deleteHoliday(id);
}