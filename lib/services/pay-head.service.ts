import * as repository from "@/lib/repositories/pay-head.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import { validatePayHead, type PayHeadValidationErrors } from "@/lib/engines/pay-head.engine";
import type { PayHead, PayHeadData, PayHeadFormData } from "@/lib/types/pay-head";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PayHeadValidationError extends Error {
  constructor(public errors: PayHeadValidationErrors) {
    super("Pay head validation failed");
    this.name = "PayHeadValidationError";
  }
}

export class PayHeadNotFoundError extends Error {
  constructor(public id: string) {
    super(`Pay head ${id} not found`);
    this.name = "PayHeadNotFoundError";
  }
}

export class StatutoryHeadDeletionError extends Error {
  constructor(public payHeadName: string) {
    super(`Cannot delete statutory system head "${payHeadName}". Statutory pay heads are required for tax, PF, SSF, and CIT calculations.`);
    this.name = "StatutoryHeadDeletionError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPayHeadData(): Promise<PayHeadData> {
  const [payHeads, departments, designations] = await Promise.all([
    repository.findAllPayHeads(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);

  const sorted = [...payHeads].sort((a, b) => a.code.localeCompare(b.code));
  
  return {
    payHeads: sorted,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
  };
}

export async function getDepartments(): Promise<Array<{ id: string; name: string }>> {
  const departments = await departmentRepository.findAllDepartments();
  return departments.map((d) => ({ id: d.id, name: d.name }));
}

export async function getDesignations(): Promise<Array<{ id: string; name: string }>> {
  const designations = await designationRepository.findAllDesignations();
  return designations.map((d) => ({ id: d.id, name: d.name }));
}

// ---------------------------------------------------------------------------
// Input shaping
// ---------------------------------------------------------------------------

// Directly passes FormData down to the repository since the repository
// now accepts Omit<PayHead, ...> which perfectly matches the required structure
function toWriteInput(data: PayHeadFormData) {
  return {
    name: data.name,
    type: data.type,
    effectOnTax: data.effectOnTax,
    calcBasis: data.calcBasis,
    calcParameter: data.calcParameter,
    calcPercent: data.calcPercent,
    // Guarantee array safety
    applicableDepartmentIds: Array.isArray(data.applicableDepartmentIds) ? data.applicableDepartmentIds : [],
    applicableDesignationIds: Array.isArray(data.applicableDesignationIds) ? data.applicableDesignationIds : [],
    flags: data.flags || {},
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

import { recordAuditLog } from "@/lib/services/audit.service";

export async function createPayHead(data: PayHeadFormData): Promise<PayHead> {
  const existing = await repository.findAllPayHeads();
  const [allDepartments, allDesignations] = await Promise.all([
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);
  
  const errors = validatePayHead({
    data,
    existing,
    validDepartmentIds: allDepartments.map((d) => d.id),
    validDesignationIds: allDesignations.map((d) => d.id),
  });
  
  if (Object.keys(errors).length > 0) {
    throw new PayHeadValidationError(errors);
  }
  
  const created = await repository.createPayHead(toWriteInput(data));

  await recordAuditLog({
    action: "ADD",
    module: "PAY_HEADS",
    recordId: `${created.name} (${created.code})`,
    newValues: {
      name: created.name,
      code: created.code,
      type: created.type,
      calcBasis: created.calcBasis,
      calcPercent: created.calcPercent,
    },
  });

  return created;
}

export async function updatePayHead(id: string, data: PayHeadFormData): Promise<PayHead> {
  const existingAll = await repository.findAllPayHeads();
  const existing = existingAll.find((h) => h.id === id);
  if (!existing) {
    throw new PayHeadNotFoundError(id);
  }

  const [allDepartments, allDesignations] = await Promise.all([
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);
  
  const errors = validatePayHead({
    data,
    existing: existingAll,
    excludeId: id,
    validDepartmentIds: allDepartments.map((d) => d.id),
    validDesignationIds: allDesignations.map((d) => d.id),
  });
  
  if (Object.keys(errors).length > 0) {
    throw new PayHeadValidationError(errors);
  }
  
  const updated = await repository.updatePayHead(id, toWriteInput(data));

  await recordAuditLog({
    action: "EDIT",
    module: "PAY_HEADS",
    recordId: `${updated.name} (${updated.code})`,
    oldValues: {
      name: existing.name,
      code: existing.code,
      type: existing.type,
      calcBasis: existing.calcBasis,
      calcPercent: existing.calcPercent,
    },
    newValues: {
      name: updated.name,
      code: updated.code,
      type: updated.type,
      calcBasis: updated.calcBasis,
      calcPercent: updated.calcPercent,
    },
  });

  return updated;
}

export async function deletePayHead(id: string): Promise<void> {
  const existing = await repository.findPayHeadById(id);
  if (!existing) {
    throw new PayHeadNotFoundError(id);
  }

  const isStatutory = !!(
    existing.flags?.isPfHead ||
    existing.flags?.isSsfHead ||
    existing.flags?.isCitHead ||
    existing.flags?.isTdsHead
  );

  if (isStatutory) {
    throw new StatutoryHeadDeletionError(existing.name);
  }

  await repository.deletePayHead(id);

  await recordAuditLog({
    action: "DELETE",
    module: "PAY_HEADS",
    recordId: `${existing.name} (${existing.code})`,
    oldValues: {
      name: existing.name,
      code: existing.code,
      type: existing.type,
    },
  });
}