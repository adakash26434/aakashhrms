import * as repo from "@/lib/repositories/overtime.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import { findAllEmploymentTypes } from "@/lib/repositories/employment-type.repository";
import { findShifts } from "@/lib/repositories/shift.repository";
import { lawful, normalizePolicy, validatePolicy } from "@/lib/engines/overtime.engine";
import type { OvertimePolicy, OvertimePolicyChange, OvertimePolicyData } from "@/lib/types/overtime";
import * as otRuleRepository from "@/lib/repositories/ot-rule.repository";
import { resolveOtMultipliers } from "@/lib/engines/ot-pay.engine";

// Overtime (4.7): the company's overtime policy. Payroll reads it through
// getPolicy() (attendance.service → month close and payroll figures).

export class OvertimeValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Some fields need attention.");
    this.name = "OvertimeValidationError";
  }
}

/**
 * The policy in force, never below the law. Before the company saves its
 * own, it is taken from System control's old overtime multipliers with
 * approval automatic, so a company already live sees no change in how
 * overtime is decided.
 */
export async function getPolicy(): Promise<{ policy: OvertimePolicy; isDefault: boolean }> {
  const stored = await repo.findPolicyValue();
  if (stored) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
    if (parsed) return { policy: lawful(normalizePolicy(parsed)), isDefault: false };
  }
  const settings = await systemControlRepository.findSettings();
  const legacy = normalizePolicy({
    workRate: settings.officeTime.otMultiplierOfficeDay,
    offRate: settings.officeTime.otMultiplierOffDay,
    rounding: 0,
    approval: "auto",
  });
  return { policy: lawful(legacy), isDefault: true };
}

/** Everything the Policies → Overtime tab shows. */
/**
 * The policy as payroll applies it: approval and rounding from the policy, the
 * rates from the OT rules (the team's ot-pay.engine; never below the Labour
 * Act's 1.5). Every screen that shows or applies overtime reads this.
 */
export async function getPayPolicy(): Promise<{ policy: OvertimePolicy; isDefault: boolean }> {
  const [{ policy, isDefault }, rules, settings] = await Promise.all([getPolicy(), otRuleRepository.findActiveOtRules(), systemControlRepository.findSettings()]);
  const rates = resolveOtMultipliers(
    rules.map((r) => ({ ruleType: r.ruleType, isActive: r.isActive, rateOfficeDay: Number(r.rateOfficeDay), rateOffDay: Number(r.rateOffDay) })),
    { work: settings.officeTime.otMultiplierOfficeDay, off: settings.officeTime.otMultiplierOffDay },
  );
  return { policy: { ...policy, workRate: rates.work, offRate: rates.off }, isDefault };
}

export async function getPolicyData(canEdit: boolean): Promise<OvertimePolicyData> {
  const [{ policy, isDefault }, history, types, shifts] = await Promise.all([getPayPolicy(), repo.findPolicyHistory(), findAllEmploymentTypes(), findShifts()]);
  return {
    policy,
    isDefault,
    history: history
      .map((h): OvertimePolicyChange | null => {
        const after = h.newValues && typeof h.newValues === "object" ? normalizePolicy((h.newValues as { policy?: unknown }).policy ?? h.newValues) : null;
        if (!after) return null;
        const beforeRaw = h.oldValues && typeof h.oldValues === "object" ? (h.oldValues as { policy?: unknown }).policy ?? h.oldValues : null;
        return { at: h.at.toISOString(), by: h.by, before: beforeRaw ? normalizePolicy(beforeRaw) : null, after };
      })
      .filter((x): x is OvertimePolicyChange => !!x),
    employmentTypes: types.filter((t) => t.isActive !== false).map((t) => ({ id: t.id, name: t.name, otEligible: !!t.isOtEligible })),
    shifts: shifts.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, otMinimumMinutes: s.otMinimumMinutes })),
    canEdit,
  };
}

/**
 * Saves the policy (the action checks: Overtime → Edit, company-wide,
 * not platform support). Rates below the Labour Act's 1.5 are refused here,
 * whatever the screen sent.
 */
export async function savePolicy(raw: unknown): Promise<{ before: OvertimePolicy; after: OvertimePolicy }> {
  const { policy: before } = await getPolicy();
  const after = normalizePolicy(raw, before);
  const errors = validatePolicy(after);
  if (Object.keys(errors).length) throw new OvertimeValidationError(errors);
  await repo.savePolicyValue(JSON.stringify(after));
  return { before, after };
}
