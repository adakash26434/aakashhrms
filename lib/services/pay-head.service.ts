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

export class PayHeadInUseError extends Error {
  constructor(public payHeadName: string, public employeeDetails: string = "") {
    super(
      `Cannot delete pay head "${payHeadName}" because it is currently assigned in employee salary mapping${employeeDetails}. Please remove this pay head from employee salary mappings before deleting.`
    );
    this.name = "PayHeadInUseError";
  }
}

export class PayHeadLinkedToPayslipError extends Error {
  constructor(public payHeadName: string, public count: number) {
    super(
      `Cannot delete pay head "${payHeadName}" because it is linked to generated employee payslips (${count} slip${count === 1 ? '' : 's'}). To maintain payroll audit history, pay heads referenced in payslips cannot be deleted.`
    );
    this.name = "PayHeadLinkedToPayslipError";
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

  const allDeptIds = departments.map((d) => d.id);
  const allDesigIds = designations.map((d) => d.id);

  // Guarantee every payhead has explicit real department and designation IDs populated
  const hydratedPayHeads = payHeads.map((h) => {
    const hasDepts = Array.isArray(h.applicableDepartmentIds) && h.applicableDepartmentIds.length > 0;
    const hasDesigs = Array.isArray(h.applicableDesignationIds) && h.applicableDesignationIds.length > 0;

    const deptIds = hasDepts ? h.applicableDepartmentIds : allDeptIds;
    const desigIds = hasDesigs ? h.applicableDesignationIds : allDesigIds;

    // Asynchronously backfill persistent database row if it had legacy empty arrays
    if ((!hasDepts && allDeptIds.length > 0) || (!hasDesigs && allDesigIds.length > 0)) {
      repository
        .updatePayHead(h.id, {
          name: h.name,
          type: h.type,
          effectOnTax: h.effectOnTax,
          calcBasis: h.calcBasis,
          calcParameter: h.calcParameter,
          calcPercent: h.calcPercent,
          applicableDepartmentIds: deptIds,
          applicableDesignationIds: desigIds,
          flags: h.flags,
        })
        .catch((err) => {
          console.warn(`[getPayHeadData] Auto-sync applicability backfill error for ${h.code}:`, err);
        });
    }

    return {
      ...h,
      applicableDepartmentIds: deptIds,
      applicableDesignationIds: desigIds,
    };
  });

  const sorted = [...hydratedPayHeads].sort((a, b) => a.code.localeCompare(b.code));
  
  return {
    payHeads: sorted,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId })),
  };
}

export async function getDepartments(): Promise<Array<{ id: string; name: string }>> {
  const departments = await departmentRepository.findAllDepartments();
  return departments.map((d) => ({ id: d.id, name: d.name }));
}

export async function getDesignations(): Promise<Array<{ id: string; name: string; departmentId?: string }>> {
  const designations = await designationRepository.findAllDesignations();
  return designations.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId }));
}

// ---------------------------------------------------------------------------
// Input shaping
// ---------------------------------------------------------------------------

// Directly passes FormData down to the repository since the repository
// now accepts Omit<PayHead, ...> which perfectly matches the required structure
function toWriteInput(data: PayHeadFormData) {
  return {
    name: data.name,
    nameNp: data.nameNp?.trim() || null,
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

  // 1. Guard against pay heads assigned in Employee Salary Mapping
  const mappingUsage = await repository.getPayHeadSalaryMappingUsage(id);
  if (mappingUsage.count > 0) {
    const sampleList = mappingUsage.sampleEmployees
      .map((e) => `${e.fullName} (${e.employeeCode})`)
      .join(", ");
    const remainder = mappingUsage.count - mappingUsage.sampleEmployees.length;
    const employeeDetails = mappingUsage.sampleEmployees.length > 0
      ? ` (assigned to ${mappingUsage.count} employee${mappingUsage.count === 1 ? '' : 's'}: ${sampleList}${remainder > 0 ? ` and ${remainder} more` : ''})`
      : ` (assigned to ${mappingUsage.count} employee${mappingUsage.count === 1 ? '' : 's'})`;

    throw new PayHeadInUseError(existing.name, employeeDetails);
  }

  // 2. Guard against pay heads linked to historical/generated Payslips
  const payslipUsage = await repository.getPayHeadPayslipUsage(id);
  if (payslipUsage.count > 0) {
    throw new PayHeadLinkedToPayslipError(existing.name, payslipUsage.count);
  }

  // 3. Fallback catch for unexpected foreign key constraints
  try {
    await repository.deletePayHead(id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("foreign key") ||
      msg.includes("23503") ||
      msg.includes("violates foreign key constraint")
    ) {
      throw new Error(
        `Cannot delete pay head "${existing.name}" because it is currently referenced by other payroll records. Please remove all references before deleting.`
      );
    }
    throw err;
  }

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