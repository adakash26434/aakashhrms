import * as repository from "@/lib/repositories/system-control.repository";
import {
  validateSystemControl,
  type SystemControlValidationErrors,
} from "@/lib/engines/system-control.engine";
import type { SystemControlData, GradePolicySettings } from "@/lib/types/system-control";
import { DEFAULT_GRADE_POLICY } from "@/lib/engines/grade-policy.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { applyPolicyGrades } from "@/lib/services/salary-structure.service";
import { findAll as findAllEmployees } from "@/lib/repositories/employee.repository";

/** Thrown when the engine rejects the payload. */
export class SystemControlValidationError extends Error {
  constructor(public errors: SystemControlValidationErrors) {
    super("System Control validation failed");
    this.name = "SystemControlValidationError";
  }
}

export interface GradeSyncResult {
  updatedEmployees: number;
  totalActive: number;
  policyMethod: string;
}

export async function getSystemControlData(): Promise<SystemControlData> {
  return repository.findSettings();
}

export async function saveSystemControlSettings(
  next: SystemControlData,
): Promise<SystemControlData> {
  const existing = await repository.findSettings();

  const errors = validateSystemControl(next);
  if (Object.keys(errors).length > 0) {
    throw new SystemControlValidationError(errors);
  }

  const updated = await repository.updateSettings(next);

  await recordAuditLog({
    action: "EDIT",
    module: "SYSTEM_CONTROL",
    recordId: "Global System Rules & Thresholds",
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

/**
 * The grade policy changed (4.4): one approved, system-prepared salary
 * revision batch for every active employee whose policy grade changes.
 * Grades typed by hand, and every grade under a "typed in" policy, are left
 * alone; nothing is edited in place, so history stays complete.
 */
export async function syncAllEmployeeGradesWithPolicy(
  policy?: GradePolicySettings,
): Promise<GradeSyncResult> {
  const effectivePolicy =
    policy || (await repository.findSettings()).gradePolicy || DEFAULT_GRADE_POLICY;
  const updatedEmployees = await applyPolicyGrades(effectivePolicy, null);
  const totalActive = (await findAllEmployees({ search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" })).length;

  if (updatedEmployees > 0) {
    await recordAuditLog({
      action: "EDIT",
      module: "SYSTEM_CONTROL",
      recordId: "Bulk Employee Grade Recalculation",
      newValues: {
        updatedEmployees,
        totalActive,
        policyMethod: effectivePolicy.calculationMethod,
      },
    });
  }

  return {
    updatedEmployees,
    totalActive,
    policyMethod: effectivePolicy.calculationMethod,
  };
}

