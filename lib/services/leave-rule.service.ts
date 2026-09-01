import * as repository from "@/lib/repositories/leave-rule.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as engine from "@/lib/engines/leave-rule.engine";
import { deduplicateStatutoryLeaves } from "@/lib/services/leave-cleanup.service";
import type {
  LeaveRule,
  LeaveRuleFormData,
  LeaveRuleKPIs,
  LeaveRuleValidationErrors,
} from "@/lib/types/leave-rule";

export class LeaveRuleValidationError extends Error {
  constructor(public errors: LeaveRuleValidationErrors) {
    super("Leave rule validation failed");
    this.name = "LeaveRuleValidationError";
  }
}

/**
 * Ensures all statutory leave types have corresponding statutory leave rules.
 * Automatically backfills missing statutory rules for existing companies.
 */
export async function ensureStatutoryLeaveRules(): Promise<void> {
  try {
    await deduplicateStatutoryLeaves();

    const [allTypes, allRules] = await Promise.all([
      leaveRepository.findAllLeaveTypes(),
      repository.findAllLeaveRules(),
    ]);

    const existingRuleTypeIds = new Set(allRules.map((r) => r.leaveTypeId));

    for (const lt of allTypes) {
      if (lt.isStatutory && !existingRuleTypeIds.has(lt.id)) {
        const isDaysWorked = lt.code === "HOME" || lt.code === "SUBSTITUTE";
        const ruleName = `${lt.name.split(" (")[0]} Statutory Policy`;
        const accrualMethod = isDaysWorked ? "DAYS_WORKED" : "FIXED_ANNUAL";
        const accrualValue = lt.code === "HOME" ? 20 : (lt.noOfDays || 1);

        await repository.createLeaveRule({
          leaveTypeId: lt.id,
          ruleName,
          ruleCategory: "STATUTORY",
          accrualMethod,
          accrualValue,
          encashmentRate: "BASIC_DAILY",
          encashmentFixedAmount: 0,
          minServiceDaysForEligibility: 0,
          isActive: true,
        });
      }
    }
  } catch (err) {
    console.error("[ensureStatutoryLeaveRules] Error:", err);
  }
}

export async function getLeaveRulesWithKPIs(): Promise<{
  rules: LeaveRule[];
  kpis: LeaveRuleKPIs;
}> {
  await ensureStatutoryLeaveRules();
  const rules = await repository.findAllLeaveRules();
  const kpis = engine.calculateLeaveRuleKPIs(rules);
  return { rules, kpis };
}

export async function getActiveLeaveRules(): Promise<LeaveRule[]> {
  return repository.findActiveLeaveRules();
}

export async function getLeaveRuleById(id: string): Promise<LeaveRule | null> {
  return repository.findLeaveRuleById(id);
}

export async function saveLeaveRule(
  id: string | null,
  formData: LeaveRuleFormData,
): Promise<LeaveRule> {
  const errors = engine.validateLeaveRuleForm(formData);
  if (Object.keys(errors).length > 0) {
    throw new LeaveRuleValidationError(errors);
  }

  if (id) {
    // Check if trying to edit a statutory rule
    const existing = await repository.findLeaveRuleById(id);
    if (existing && existing.ruleCategory === "STATUTORY") {
      // Only allow toggling status for statutory rules
      const updated = await repository.updateLeaveRule(id, {
        isActive: formData.isActive,
      });
      if (!updated) throw new Error("Leave rule not found");
      return updated;
    }

    const updated = await repository.updateLeaveRule(id, {
      leaveTypeId: formData.leaveTypeId,
      fiscalYearId: formData.fiscalYearId || null,
      ruleName: formData.ruleName,
      ruleCategory: formData.ruleCategory,
      accrualMethod: formData.accrualMethod,
      accrualValue: formData.accrualValue,
      encashmentRate: formData.encashmentRate,
      encashmentFixedAmount: formData.encashmentFixedAmount,
      minServiceDaysForEligibility: formData.minServiceDaysForEligibility,
      isActive: formData.isActive,
    });
    if (!updated) throw new Error("Leave rule not found");
    return updated;
  }

  return repository.createLeaveRule({
    leaveTypeId: formData.leaveTypeId,
    fiscalYearId: formData.fiscalYearId || null,
    ruleName: formData.ruleName,
    ruleCategory: formData.ruleCategory,
    accrualMethod: formData.accrualMethod,
    accrualValue: formData.accrualValue,
    encashmentRate: formData.encashmentRate,
    encashmentFixedAmount: formData.encashmentFixedAmount,
    minServiceDaysForEligibility: formData.minServiceDaysForEligibility,
    isActive: formData.isActive,
  });
}

export async function deleteLeaveRule(id: string): Promise<boolean> {
  const existing = await repository.findLeaveRuleById(id);
  if (!existing) throw new Error("Leave rule not found");

  // Statutory rules cannot be deleted
  if (existing.ruleCategory === "STATUTORY") {
    throw new Error("Statutory leave rules cannot be deleted. They are mandated by Nepal Labour Act 2074.");
  }

  return repository.removeLeaveRule(id);
}

export async function toggleLeaveRuleStatus(
  id: string,
  isActive: boolean,
): Promise<LeaveRule | null> {
  return repository.updateLeaveRule(id, { isActive });
}
