import Decimal from "decimal.js";
import type { GradePolicySettings, GradeCalculationMethod } from "@/lib/types/system-control";

/**
 * Result of promotion salary non-reduction validation
 */
export interface PromotionSalaryValidationResult {
  isValid: boolean;
  oldTotalBase: number;
  newLevelMinBasic: number;
  proposedNewBasic: number;
  targetMinimumTotal: number;
  shortfall: number;
  recommendedSteppingGrades: number;
  recommendedAdjustedBasic: number;
  warningMessage?: string;
}

/**
 * Default standard Nepal statutory grade policy
 */
export const DEFAULT_GRADE_POLICY: GradePolicySettings = {
  calculationMethod: "STATUTORY_DAILY_RATE",
  daysInMonthForDailyRate: 30,
  fixedGradePercent: 3.33,
  fixedAmountPerGrade: 0,
  maxGradesAllowedPerLevel: 10,
  promotionRule: {
    enforceNonReduction: true,
    guaranteeMinimumOneNewGrade: true,
    handlingMethod: "RESET_TO_ZERO_WITH_STEPPING",
  },
};

/**
 * Calculates the monetary value of 1 grade based on the active company policy.
 * 
 * Rules:
 * 1. STATUTORY_DAILY_RATE (Nepal Standard): 1 Grade = 1 day's basic salary = Basic / 30
 * 2. PERCENTAGE_OF_BASIC: 1 Grade = Basic * (fixedGradePercent / 100)
 * 3. FIXED_AMOUNT_PER_GRADE: 1 Grade = fixed amount (e.g. NPR 1,000)
 * 4. MANUAL_INPUT / DISABLED_NO_GRADES: 0 (or manually typed)
 */
export function calculateGradeRate(basicSalary: number, policy: GradePolicySettings = DEFAULT_GRADE_POLICY): number {
  const basic = new Decimal(Math.max(0, basicSalary || 0));
  if (basic.lte(0)) return 0;

  switch (policy.calculationMethod) {
    case "STATUTORY_DAILY_RATE": {
      const days = policy.daysInMonthForDailyRate > 0 ? policy.daysInMonthForDailyRate : 30;
      return basic.dividedBy(days).toDecimalPlaces(2).toNumber();
    }
    case "PERCENTAGE_OF_BASIC": {
      const pct = new Decimal(policy.fixedGradePercent || 3.33).dividedBy(100);
      return basic.times(pct).toDecimalPlaces(2).toNumber();
    }
    case "FIXED_AMOUNT_PER_GRADE": {
      return Math.max(0, policy.fixedAmountPerGrade || 0);
    }
    case "MANUAL_INPUT":
    case "DISABLED_NO_GRADES":
    default:
      return 0;
  }
}

/**
 * Calculates the total monthly grade amount based on grade count and active policy.
 * Automatically respects maxGradesAllowedPerLevel cap.
 */
export function calculateTotalGradeAmount(
  basicSalary: number,
  gradeCount: number,
  policy: GradePolicySettings = DEFAULT_GRADE_POLICY,
  overrideAmount?: number
): number {
  if (policy.calculationMethod === "DISABLED_NO_GRADES") {
    return 0;
  }

  if (overrideAmount !== undefined && overrideAmount !== null && overrideAmount >= 0 && policy.calculationMethod === "MANUAL_INPUT") {
    return overrideAmount;
  }

  const rawCount = Math.max(0, Math.floor(gradeCount || 0));
  const effectiveCount = policy.maxGradesAllowedPerLevel > 0 
    ? Math.min(rawCount, policy.maxGradesAllowedPerLevel)
    : rawCount;

  if (effectiveCount === 0) return 0;

  const rate = calculateGradeRate(basicSalary, policy);
  return new Decimal(effectiveCount).times(rate).toDecimalPlaces(2).toNumber();
}

/**
 * Validates promotion salary according to Nepal's Principle of Non-Reduction of Pay
 * (Civil Service Rules Rule 113 & Corporate/BFI HR Bylaws).
 * 
 * Principle: New Total Pay >= Old Basic + Old Grade (+ 1 New Grade if guaranteed)
 */
export function validatePromotionSalary(params: {
  oldBasic: number;
  oldGradeAmount: number;
  newBasic: number;
  newLevelMinBasic: number;
  policy?: GradePolicySettings;
}): PromotionSalaryValidationResult {
  const policy = params.policy || DEFAULT_GRADE_POLICY;
  const oldBasic = Math.max(0, params.oldBasic || 0);
  const oldGrade = Math.max(0, params.oldGradeAmount || 0);
  const oldTotalBase = new Decimal(oldBasic).plus(oldGrade).toNumber();

  const newLevelMin = Math.max(0, params.newLevelMinBasic || 0);
  const proposedNewBasic = Math.max(0, params.newBasic || newLevelMin);

  // Compute 1 grade of the new level
  const baseForNewGradeRate = proposedNewBasic > 0 ? proposedNewBasic : newLevelMin;
  const new1GradeRate = calculateGradeRate(baseForNewGradeRate, policy);

  // Target minimum required total pay under promotion policy
  const guaranteeInc = policy.promotionRule.guaranteeMinimumOneNewGrade ? new1GradeRate : 0;
  const targetMinimumTotal = new Decimal(oldTotalBase).plus(guaranteeInc).toDecimalPlaces(2).toNumber();

  // If newly proposed basic already equals or exceeds targetMinimumTotal, it's valid
  const currentTotal = proposedNewBasic;
  const shortfall = Math.max(0, new Decimal(targetMinimumTotal).minus(currentTotal).toNumber());
  const isValid = !policy.promotionRule.enforceNonReduction || shortfall <= 0;

  // Compute compensatory stepping grades if handlingMethod is stepping
  const recommendedSteppingGrades = shortfall > 0 && new1GradeRate > 0
    ? Math.ceil(new Decimal(shortfall).dividedBy(new1GradeRate).toNumber())
    : 0;

  const recommendedAdjustedBasic = Math.max(proposedNewBasic, targetMinimumTotal);

  let warningMessage: string | undefined;
  if (!isValid) {
    warningMessage = `Promotion Non-Reduction Warning: The employee's previous total base was NPR ${oldTotalBase.toLocaleString()}. Under policy, the new pay must be at least NPR ${targetMinimumTotal.toLocaleString()} (deficit of NPR ${shortfall.toLocaleString()}).`;
  }

  return {
    isValid,
    oldTotalBase,
    newLevelMinBasic: newLevelMin,
    proposedNewBasic,
    targetMinimumTotal,
    shortfall,
    recommendedSteppingGrades,
    recommendedAdjustedBasic,
    warningMessage,
  };
}
