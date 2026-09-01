import * as repository from "@/lib/repositories/leave.repository";
import * as engine from "@/lib/engines/leave-type.engine";
import { deduplicateStatutoryLeaves } from "@/lib/services/leave-cleanup.service";
import type {
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeaveTypeKPIs,
  LeaveTypeValidationErrors,
} from "@/lib/types/leave-type";

export class LeaveTypeValidationError extends Error {
  constructor(public errors: LeaveTypeValidationErrors) {
    super("Leave type validation failed");
    this.name = "LeaveTypeValidationError";
  }
}

export async function getLeaveTypesWithKPIs(): Promise<{
  types: LeaveTypeRecord[];
  kpis: LeaveTypeKPIs;
}> {
  await deduplicateStatutoryLeaves();
  const types = await repository.findAllLeaveTypesIncludingInactive();
  const kpis = engine.calculateLeaveTypeKPIs(types);
  return { types, kpis };
}

export async function getActiveLeaveTypes(): Promise<LeaveTypeRecord[]> {
  return repository.findAllLeaveTypes();
}

export async function getLeaveTypeById(id: string): Promise<LeaveTypeRecord | null> {
  return repository.findLeaveTypeById(id);
}

export async function saveLeaveType(
  id: string | null,
  formData: LeaveTypeFormData,
): Promise<LeaveTypeRecord> {
  const errors = engine.validateLeaveTypeForm(formData);
  if (Object.keys(errors).length > 0) {
    throw new LeaveTypeValidationError(errors);
  }

  if (id) {
    // Check if trying to edit a statutory leave type
    const existing = await repository.findLeaveTypeById(id);
    if (existing && existing.isStatutory) {
      // For statutory types, only allow editing limited fields
      const updated = await repository.updateLeaveType(id, {
        noOfDays: formData.noOfDays,
        accumulationCap: formData.accumulationCap,
        requiresDocument: formData.requiresDocument,
        documentThresholdDays: formData.documentThresholdDays,
        applicableDepartments: formData.applicableDepartments,
        applicableDesignations: formData.applicableDesignations,
        isActive: formData.isActive,
      });
      if (!updated) throw new Error("Leave type not found");
      return updated;
    }

    const updated = await repository.updateLeaveType(id, {
      name: formData.name,
      code: formData.code,
      leaveType: formData.leaveType,
      noOfDays: formData.noOfDays,
      carryForward: formData.carryForward,
      accumulationCap: formData.accumulationCap,
      maxPaidDays: formData.maxPaidDays,
      genderApplicable: formData.genderApplicable,
      requiresDocument: formData.requiresDocument,
      documentThresholdDays: formData.documentThresholdDays,
      isEncashable: formData.isEncashable,
      encashmentBasis: formData.encashmentBasis,
      proRataForNewJoinees: formData.proRataForNewJoinees,
      applicableDepartments: formData.applicableDepartments,
      applicableDesignations: formData.applicableDesignations,
      isActive: formData.isActive,
    });
    if (!updated) throw new Error("Leave type not found");
    return updated;
  }

  return repository.createLeaveType({
    name: formData.name,
    code: formData.code,
    leaveType: formData.leaveType,
    noOfDays: formData.noOfDays,
    carryForward: formData.carryForward,
    accumulationCap: formData.accumulationCap,
    maxPaidDays: formData.maxPaidDays,
    isStatutory: false,  // Only company types can be created via UI
    statutoryCode: null,
    genderApplicable: formData.genderApplicable,
    requiresDocument: formData.requiresDocument,
    documentThresholdDays: formData.documentThresholdDays,
    isEncashable: formData.isEncashable,
    encashmentBasis: formData.encashmentBasis,
    proRataForNewJoinees: formData.proRataForNewJoinees,
    applicableDepartments: formData.applicableDepartments,
    applicableDesignations: formData.applicableDesignations,
    isActive: formData.isActive,
  });
}

export async function deleteLeaveType(id: string): Promise<boolean> {
  const existing = await repository.findLeaveTypeById(id);
  if (!existing) throw new Error("Leave type not found");

  // Statutory leave types cannot be deleted
  if (existing.isStatutory) {
    throw new Error("Statutory leave types cannot be deleted. They are mandated by Nepal Labour Act 2074.");
  }

  return repository.removeLeaveType(id);
}

export async function toggleLeaveTypeStatus(
  id: string,
  isActive: boolean,
): Promise<LeaveTypeRecord | null> {
  return repository.updateLeaveType(id, { isActive });
}
