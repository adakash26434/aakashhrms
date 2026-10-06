import * as repository from "@/lib/repositories/leave.repository";
import * as engine from "@/lib/engines/leave-type.engine";
import { deduplicateStatutoryLeaves } from "@/lib/services/leave-cleanup.service";
import { UserFacingError } from "@/lib/errors/action-error";
import type {
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeaveTypeKPIs,
  LeaveTypeValidationErrors,
} from "@/lib/types/leave-type";

const STATUTORY_LOCKED = "Statutory leave follows the Labour Act and can't be changed here. Choose it under Statutory leave on this tab and Propose a change: only in the employees' favour, approved by a second person.";

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
    // Statutory types follow the Labour Act: they change only through a proposal a
    // second person approves (leave-policy.service), never below the law (S24).
    if (existing && existing.isStatutory) throw new UserFacingError(STATUTORY_LOCKED);

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
  if (!existing) throw new UserFacingError("This leave type no longer exists.");
  if (existing.isStatutory) throw new UserFacingError("Statutory leave follows the Labour Act and can't be deleted.");
  // Requests and the leave ledger keep their history: a used type is switched off instead.
  if (await repository.leaveTypeInUse(id)) throw new UserFacingError(`${existing.name} has been used in requests or balances, so it can't be deleted. Switch it off instead.`);
  return repository.removeLeaveType(id);
}

export async function toggleLeaveTypeStatus(
  id: string,
  isActive: boolean,
): Promise<LeaveTypeRecord | null> {
  const existing = await repository.findLeaveTypeById(id);
  if (existing?.isStatutory) throw new UserFacingError(STATUTORY_LOCKED);
  return repository.updateLeaveType(id, { isActive });
}
