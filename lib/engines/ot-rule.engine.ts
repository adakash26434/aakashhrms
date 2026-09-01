import type {
  OtRule,
  OtRuleFormData,
  OtRuleValidationErrors,
  OtRuleKPIs,
  OtRuleType,
} from "@/lib/types/ot-rule";

/**
 * Validate an overtime rule form submission.
 */
export function validateOtRuleForm(
  data: OtRuleFormData,
): OtRuleValidationErrors {
  const errors: OtRuleValidationErrors = {};

  if (!data.ruleName.trim()) {
    errors.ruleName = "Rule name is required";
  }

  if (data.rateOfficeDay <= 0) {
    errors.rateOfficeDay = "Office day rate must be greater than 0";
  }

  if (data.rateOffDay <= 0) {
    errors.rateOffDay = "Off day rate must be greater than 0";
  }

  return errors;
}

/**
 * Calculate OT KPIs from a list of rules.
 */
export function calculateOtRuleKPIs(rules: OtRule[]): OtRuleKPIs {
  return {
    total: rules.length,
    hourly: rules.filter((r) => r.ruleType === "Hourly" && r.isActive).length,
    fixed: rules.filter((r) => r.ruleType === "Fixed" && r.isActive).length,
  };
}

/**
 * Format a rule type label for display.
 */
export function formatRuleType(ruleType: OtRuleType): string {
  return ruleType === "Hourly" ? "Hourly Rate" : "Fixed Amount";
}

/**
 * Format rate for display with appropriate unit.
 * - Hourly: "X.Xx Basic Hourly Rate"
 * - Fixed: "NPR X/day"
 */
export function formatOtRate(
  rate: number,
  ruleType: OtRuleType,
): string {
  if (rate <= 0) {
    return "—";
  }
  if (ruleType === "Hourly") {
    return `${rate.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}x Basic Hourly Rate`;
  }
  return `NPR ${rate.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/day`;
}

/**
 * Calculate overtime amount based on rule type and units.
 * ruleType = "Hourly" → rate is per hour
 * ruleType = "Fixed"  → rate is per day
 */
export function calculateOtAmount(
  units: number,       // hours (if Hourly) or days (if Fixed)
  rate: number,
  ruleType: OtRuleType,
): number {
  return units * rate;
}