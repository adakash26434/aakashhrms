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

  // Manual Attendance
  yearlyInsurancePremiumLimit?: string;

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
  remoteAllowanceNpr?: string;

  // Overtime
  otMultiplierOfficeDay?: string;
  otMultiplierOffDay?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isValidHour(h: number): boolean {
  return Number.isInteger(h) && h >= 1 && h <= 12;
}
function isValidMinute(m: number): boolean {
  return Number.isInteger(m) && m >= 0 && m < 60;
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
 * Validate the full System Control payload. Each field can
 * independently fail. Returns an empty object when valid.
 */
export function validateSystemControl(
  data: SystemControlData,
): SystemControlValidationErrors {
  const errors: SystemControlValidationErrors = {};

  // Office time
  if (!isValidHour(data.officeTime.inTime.hour)) {
    errors.officeInHour = "Hour must be 1–12.";
  }
  if (!isValidMinute(data.officeTime.inTime.minute)) {
    errors.officeInMinute = "Minute must be 0–59.";
  }
  if (!isValidHour(data.officeTime.outTime.hour)) {
    errors.officeOutHour = "Hour must be 1–12.";
  }
  if (!isValidMinute(data.officeTime.outTime.minute)) {
    errors.officeOutMinute = "Minute must be 0–59.";
  }
  if (!isNonNegativeInt(data.officeTime.graceWindowMinutes)) {
    errors.graceWindowMinutes = "Must be a non-negative whole number.";
  } else if (data.officeTime.graceWindowMinutes > 120) {
    errors.graceWindowMinutes = "Must be 120 minutes or less.";
  }

  // Manual attendance
  if (!isNonNegativeInt(data.manualAttendance.yearlyInsurancePremiumLimit)) {
    errors.yearlyInsurancePremiumLimit = "Must be a non-negative whole number.";
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
  if (!isPercent(data.statutoryDeductionLimits.handicappedDeductionPercent)) {
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
