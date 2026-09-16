/**
 * System Control engine — pure range/bound checks on the
 * configuration payload.
 *
 * System Control has no complex business rules like Tax Rate, but
 * it DOES have numeric bounds (hours 1–12, percentages 0–100, NPR
 * amounts non-negative) that are worth centralising so the UI
 * form, the service layer, and the future backend all share one
 * truth.
 *
 * Used by:
 *   1. The System Control Setup UI (client-side instant feedback)
 *   2. The service layer (re-validates before persisting — the
 *      authoritative gate)
 *   3. Unit tests
 */

import type { SystemControlData } from "@/lib/types/system-control";

export interface SystemControlValidationErrors {
  // Office Time
  officeInHour?: string;
  officeInMinute?: string;
  officeOutHour?: string;
  officeOutMinute?: string;
  graceWindowMinutes?: string;

  // Statutory
  pfMaximumLimitPercent?: string;
  citLimitNpr?: string;
  retirementFundLimitNpr?: string;
  handicappedDeductionPercent?: string;

  // Insurance
  medicalInsuranceNpr?: string;
  houseInsuranceNpr?: string;
  lifeInsuranceNpr?: string;
  womenDiscountPercent?: string;
  handicappedDiscountPercent?: string;
  remoteAllowanceNpr?: string;

  // Overtime
  otMultiplierOfficeDay?: string;
  otMultiplierOffDay?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isClockHour(h: number): boolean {
  return Number.isInteger(h) && h >= 1 && h <= 12;
}
function isMinute(m: number): boolean {
  return Number.isInteger(m) && m >= 0 && m < 60;
}
function isGrace(g: number): boolean {
  return Number.isInteger(g) && g >= 0 && g <= 120;
}
function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}
function isPercent(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a whole SystemControlData payload.
 * Pure function: takes data, returns error map. An empty map means valid.
 */
export function validateSystemControl(
  data: SystemControlData,
): SystemControlValidationErrors {
  const errors: SystemControlValidationErrors = {};

  // Office time
  if (data.officeTime?.inTime && !isClockHour(data.officeTime.inTime.hour)) {
    errors.officeInHour = "Hour must be 1–12.";
  }
  if (data.officeTime?.inTime && !isMinute(data.officeTime.inTime.minute)) {
    errors.officeInMinute = "Minute must be 0–59.";
  }
  if (data.officeTime?.outTime && !isClockHour(data.officeTime.outTime.hour)) {
    errors.officeOutHour = "Hour must be 1–12.";
  }
  if (data.officeTime?.outTime && !isMinute(data.officeTime.outTime.minute)) {
    errors.officeOutMinute = "Minute must be 0–59.";
  }
  if (data.officeTime?.graceWindowMinutes !== undefined && !isGrace(data.officeTime.graceWindowMinutes)) {
    errors.graceWindowMinutes = "Grace window must be 0–120 minutes.";
  }

  // Statutory
  if (!isPercent(data.statutoryDeductionLimits.pfMaximumLimitPercent)) {
    errors.pfMaximumLimitPercent = "Must be 0–100.";
  }
  if (!isNonNegativeInt(data.statutoryDeductionLimits.citLimitNpr)) {
    errors.citLimitNpr = "Must be a non-negative whole number.";
  }
  if (!isNonNegativeInt(data.statutoryDeductionLimits.retirementFundLimitNpr)) {
    errors.retirementFundLimitNpr = "Must be a non-negative whole number.";
  }
  if (data.statutoryDeductionLimits.handicappedDeductionPercent !== undefined && !isPercent(data.statutoryDeductionLimits.handicappedDeductionPercent)) {
    errors.handicappedDeductionPercent = "Must be 0–100.";
  }

  // Insurance / discounts
  if (!isNonNegativeInt(data.insuranceDiscounts.medicalInsuranceNpr)) {
    errors.medicalInsuranceNpr = "Must be a non-negative whole number.";
  }
  if (!isNonNegativeInt(data.insuranceDiscounts.houseInsuranceNpr)) {
    errors.houseInsuranceNpr = "Must be a non-negative whole number.";
  }
  if (!isNonNegativeInt(data.insuranceDiscounts.lifeInsuranceNpr)) {
    errors.lifeInsuranceNpr = "Must be a non-negative whole number.";
  }
  if (!isPercent(data.insuranceDiscounts.womenDiscountPercent)) {
    errors.womenDiscountPercent = "Must be 0–100.";
  }
  if (data.insuranceDiscounts.handicappedDiscountPercent !== undefined && !isPercent(data.insuranceDiscounts.handicappedDiscountPercent)) {
    errors.handicappedDiscountPercent = "Must be 0–100.";
  }
  if (!isNonNegativeInt(data.insuranceDiscounts.remoteAllowanceNpr)) {
    errors.remoteAllowanceNpr = "Must be a non-negative whole number.";
  }

  // Overtime multipliers
  if (data.officeTime.otMultiplierOfficeDay !== undefined && data.officeTime.otMultiplierOfficeDay !== 1.5) {
    errors.otMultiplierOfficeDay = "Office Day overtime multiplier must be exactly 1.5.";
  }
  if (data.officeTime.otMultiplierOffDay !== undefined && data.officeTime.otMultiplierOffDay < 1.5) {
    errors.otMultiplierOffDay = "Off Day overtime multiplier cannot be less than 1.5.";
  }

  return errors;
}
