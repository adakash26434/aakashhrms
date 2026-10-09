import { OT_MIN_MULTIPLIER } from "@/lib/engines/ot-pay.engine";
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

  // Payroll pays hourly rules as multipliers of the hourly rate (4.7); the Labour Act minimum is 1.5.
  if (data.ruleType === "Hourly") {
    if (data.rateOfficeDay > 0 && data.rateOfficeDay < OT_MIN_MULTIPLIER) {
      errors.rateOfficeDay = `Office day multiplier cannot be below ${OT_MIN_MULTIPLIER} (Labour Act)`;
    }
    if (data.rateOffDay > 0 && data.rateOffDay < OT_MIN_MULTIPLIER) {
      errors.rateOffDay = `Off day multiplier cannot be below ${OT_MIN_MULTIPLIER} (Labour Act)`;
    }
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