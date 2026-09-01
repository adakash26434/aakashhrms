import * as repository from "@/lib/repositories/ot-rule.repository";
import * as engine from "@/lib/engines/ot-rule.engine";
import type {
  OtRule,
  OtRuleFormData,
  OtRuleKPIs,
  OtRuleValidationErrors,
} from "@/lib/types/ot-rule";

export class OtRuleValidationError extends Error {
  constructor(public errors: OtRuleValidationErrors) {
    super("OT rule validation failed");
    this.name = "OtRuleValidationError";
  }
}

// ──────────────────────────────────────────────
// OT Rules
// ──────────────────────────────────────────────

export async function getOtRulesWithKPIs(): Promise<{
  rules: OtRule[];
  kpis: OtRuleKPIs;
}> {
  const rules = await repository.findAllOtRules();
  const kpis = engine.calculateOtRuleKPIs(rules);
  return { rules, kpis };
}

export async function getActiveOtRules(): Promise<OtRule[]> {
  return repository.findActiveOtRules();
}

export async function getOtRuleById(id: string): Promise<OtRule | null> {
  return repository.findOtRuleById(id);
}

export async function saveOtRule(
  id: string | null,
  formData: OtRuleFormData,
): Promise<OtRule> {
  const errors = engine.validateOtRuleForm(formData);
  if (Object.keys(errors).length > 0) {
    throw new OtRuleValidationError(errors);
  }

  if (id) {
    const updated = await repository.updateOtRule(id, formData);
    if (!updated) throw new Error("OT rule not found");
    return updated;
  }

  return repository.createOtRule(formData);
}

export async function deleteOtRule(id: string): Promise<boolean> {
  const existing = await repository.findOtRuleById(id);
  if (!existing) throw new Error("OT rule not found");
  return repository.removeOtRule(id);
}

export async function toggleOtRuleStatus(
  id: string,
  isActive: boolean,
): Promise<OtRule | null> {
  return repository.updateOtRule(id, { isActive });
}