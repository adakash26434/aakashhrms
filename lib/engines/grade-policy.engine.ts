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

// ---------------------------------------------------------------------------
// Employee pay (4.2): how a grade is worked out, and what may be saved
// ---------------------------------------------------------------------------

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** The policy method in words, for the form's breakdown and the record page. */
export function gradeMethodLabel(policy: GradePolicySettings = DEFAULT_GRADE_POLICY): string {
  switch (policy.calculationMethod) {
    case "STATUTORY_DAILY_RATE":
      return `One day's basic per grade (basic ÷ ${policy.daysInMonthForDailyRate > 0 ? policy.daysInMonthForDailyRate : 30})`;
    case "PERCENTAGE_OF_BASIC":
      return `${policy.fixedGradePercent || 3.33}% of basic per grade`;
    case "FIXED_AMOUNT_PER_GRADE":
      return `NPR ${money(Math.max(0, policy.fixedAmountPerGrade || 0))} per grade`;
    case "MANUAL_INPUT":
      return "Typed in for each employee";
    case "DISABLED_NO_GRADES":
    default:
      return "Grades are not used";
  }
}

export interface GradeBreakdown {
  method: GradeCalculationMethod;
  methodLabel: string;
  /** Value of one grade (0 when the policy does not calculate). */
  rate: number;
  /** Grades entered, and grades paid after the cap. */
  count: number;
  counted: number;
  cap: number;
  capped: boolean;
  amount: number;
  /** e.g. "30,000 ÷ 30 = 1,000 × 3 = 3,000"; "" when the policy does not calculate. */
  formula: string;
}

/** How the grade amount comes out of the policy, step by step (the form's breakdown panel). */
export function gradeBreakdown(basicSalary: number, gradeCount: number, policy: GradePolicySettings = DEFAULT_GRADE_POLICY): GradeBreakdown {
  const basic = Math.max(0, basicSalary || 0);
  const count = Math.max(0, Math.floor(gradeCount || 0));
  const cap = Math.max(0, policy.maxGradesAllowedPerLevel || 0);
  const counted = cap > 0 ? Math.min(count, cap) : count;
  const rate = calculateGradeRate(basic, policy);
  const amount = calculateTotalGradeAmount(basic, count, policy);
  const calculates = policy.calculationMethod !== "MANUAL_INPUT" && policy.calculationMethod !== "DISABLED_NO_GRADES";
  let formula = "";
  if (calculates) {
    const step =
      policy.calculationMethod === "STATUTORY_DAILY_RATE"
        ? `${money(basic)} ÷ ${policy.daysInMonthForDailyRate > 0 ? policy.daysInMonthForDailyRate : 30} = ${money(rate)}`
        : policy.calculationMethod === "PERCENTAGE_OF_BASIC"
          ? `${money(basic)} × ${policy.fixedGradePercent || 3.33}% = ${money(rate)}`
          : money(rate);
    formula = `${step} × ${counted} = ${money(amount)}`;
  }
  return {
    method: policy.calculationMethod,
    methodLabel: gradeMethodLabel(policy),
    rate,
    count,
    counted,
    cap,
    capped: calculates && cap > 0 && count > cap,
    amount,
    formula,
  };
}

export interface EmployeePay {
  basicSalary: number;
  gradeCount: number;
  gradeAmount: number;
  /** The grade amount was typed by hand (not worked out by the policy). */
  gradeManual: boolean;
}

/**
 * The pay that may be saved for an employee (security plan S18). The server
 * calls this; what the browser sent is never trusted on its own:
 * - without Salary mapping → Edit, an existing employee keeps their stored
 *   pay, and a new hire starts on the level's starting salary with no grades;
 * - with it, basic and grade count are as typed; the grade amount follows the
 *   policy unless it is typed by hand (or the policy is "typed in");
 * - a "no grades" policy always saves a grade amount of 0.
 */
export function resolvePay(params: {
  submitted: EmployeePay;
  stored: EmployeePay | null;
  policy: GradePolicySettings | null | undefined;
  canEditPay: boolean;
  /** Starting salary of the chosen level, for a new hire entered without pay permission. */
  levelStartingSalary?: number;
}): EmployeePay {
  const policy = params.policy ?? DEFAULT_GRADE_POLICY;
  if (!params.canEditPay) {
    if (params.stored) return { ...params.stored };
    const basic = Math.max(0, params.levelStartingSalary || 0);
    return { basicSalary: basic, gradeCount: 0, gradeAmount: 0, gradeManual: false };
  }
  const basicSalary = new Decimal(Math.max(0, Number(params.submitted.basicSalary) || 0)).toDecimalPlaces(2).toNumber();
  const gradeCount = Math.max(0, Math.floor(Number(params.submitted.gradeCount) || 0));
  const typed = new Decimal(Math.max(0, Number(params.submitted.gradeAmount) || 0)).toDecimalPlaces(2).toNumber();
  switch (policy.calculationMethod) {
    case "DISABLED_NO_GRADES":
      return { basicSalary, gradeCount, gradeAmount: 0, gradeManual: false };
    case "MANUAL_INPUT":
      return { basicSalary, gradeCount, gradeAmount: typed, gradeManual: !!params.submitted.gradeManual };
    default:
      return params.submitted.gradeManual
        ? { basicSalary, gradeCount, gradeAmount: typed, gradeManual: true }
        : { basicSalary, gradeCount, gradeAmount: calculateTotalGradeAmount(basicSalary, gradeCount, policy), gradeManual: false };
  }
}

/**
 * The grade amount a policy re-sync should give an employee, or null to leave
 * it alone: grades typed by hand, and every grade under a "typed in" policy,
 * are never overwritten; a "no grades" policy sets 0.
 */
export function policySyncedGradeAmount(
  employee: { basicSalary: number; gradeCount: number; gradeManual: boolean },
  policy: GradePolicySettings = DEFAULT_GRADE_POLICY
): number | null {
  if (policy.calculationMethod === "MANUAL_INPUT" || employee.gradeManual) return null;
  if (policy.calculationMethod === "DISABLED_NO_GRADES") return 0;
  return calculateTotalGradeAmount(employee.basicSalary, employee.gradeCount, policy);
}
