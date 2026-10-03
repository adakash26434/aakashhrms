import * as repository from "@/lib/repositories/system-control.repository";
import {
  validateSystemControl,
  type SystemControlValidationErrors,
} from "@/lib/engines/system-control.engine";
import type { SystemControlData, GradePolicySettings } from "@/lib/types/system-control";
import {
  DEFAULT_GRADE_POLICY,
  policySyncedGradeAmount,
} from "@/lib/engines/grade-policy.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { getDb } from "@/lib/db";
import { employees, employeeSalaryMap } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Decimal from "decimal.js";

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
 * Recalculates and synchronizes the grade amount for all active employees
 * according to the specified (or currently configured) grade policy.
 * Updates both the `employees` table and active `employee_salary_map` records.
 */
export async function syncAllEmployeeGradesWithPolicy(
  policy?: GradePolicySettings,
): Promise<GradeSyncResult> {
  const db = (await getDb());
  const effectivePolicy =
    policy || (await repository.findSettings()).gradePolicy || DEFAULT_GRADE_POLICY;

  // 1. Fetch all active employees with basic salary and grade count
  const activeEmployees = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      basicSalary: employees.basicSalary,
      gradeCount: employees.gradeCount,
      gradeAmount: employees.gradeAmount,
      gradeManual: employees.gradeManual,
    })
    .from(employees)
    .where(eq(employees.status, "Active"));

  let updatedEmployees = 0;

  for (const emp of activeEmployees) {
    // Grades typed by hand, and every grade under a "typed in" policy, are left alone (4.2).
    const newGradeAmount = policySyncedGradeAmount(
      { basicSalary: Number(emp.basicSalary) || 0, gradeCount: emp.gradeCount ?? 0, gradeManual: !!emp.gradeManual },
      effectivePolicy,
    );
    if (newGradeAmount !== null) {
      const currentGradeAmount = Number(emp.gradeAmount) || 0;

      // Check if value changed
      if (Math.abs(newGradeAmount - currentGradeAmount) > 0.001) {
        // Update employee table
        await db
          .update(employees)
          .set({
            gradeAmount: newGradeAmount.toString(),
            updatedAt: new Date(),
          })
          .where(eq(employees.id, emp.id));

        // Update active employee_salary_map if present
        const activeMaps = await db
          .select({
            id: employeeSalaryMap.id,
            gradeAmount: employeeSalaryMap.gradeAmount,
            netAmount: employeeSalaryMap.netAmount,
          })
          .from(employeeSalaryMap)
          .where(
            and(
              eq(employeeSalaryMap.employeeId, emp.id),
              eq(employeeSalaryMap.isActive, true),
            ),
          );

        for (const map of activeMaps) {
          const currentMapGrade = Number(map.gradeAmount) || 0;
          const currentNet = Number(map.netAmount) || 0;
          // netAmount changes by the delta between new grade amount and old map grade amount
          const delta = newGradeAmount - currentMapGrade;
          const updatedNet = new Decimal(currentNet)
            .plus(delta)
            .toDecimalPlaces(2)
            .toNumber();

          await db
            .update(employeeSalaryMap)
            .set({
              gradeAmount: newGradeAmount.toString(),
              netAmount: updatedNet.toString(),
              updatedAt: new Date(),
            })
            .where(eq(employeeSalaryMap.id, map.id));
        }

        updatedEmployees++;
      }
    }
  }

  if (updatedEmployees > 0) {
    await recordAuditLog({
      action: "EDIT",
      module: "SYSTEM_CONTROL",
      recordId: "Bulk Employee Grade Recalculation",
      newValues: {
        updatedEmployees,
        totalActive: activeEmployees.length,
        policyMethod: effectivePolicy.calculationMethod,
      },
    });
  }

  return {
    updatedEmployees,
    totalActive: activeEmployees.length,
    policyMethod: effectivePolicy.calculationMethod,
  };
}

