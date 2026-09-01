import type {
  LeaveRule,
  LeaveRuleFormData,
  LeaveRuleValidationErrors,
  LeaveRuleKPIs,
  LeaveRuleCategory,
  AccrualMethod,
} from "@/lib/types/leave-rule";

/**
 * Validate a leave rule form submission.
 */
export function validateLeaveRuleForm(
  data: LeaveRuleFormData,
): LeaveRuleValidationErrors {
  const errors: LeaveRuleValidationErrors = {};

  if (!data.leaveTypeId) {
    errors.leaveTypeId = "Leave type is required";
  }

  if (!data.ruleName.trim()) {
    errors.ruleName = "Rule name is required";
  }

  if (!data.accrualMethod) {
    errors.accrualMethod = "Accrual method is required";
  }

  if (data.accrualValue <= 0) {
    errors.accrualValue = "Accrual value must be greater than 0";
  }

  if (data.encashmentRate === "FIXED_AMOUNT" && data.encashmentFixedAmount <= 0) {
    errors.encashmentFixedAmount = "Fixed amount must be greater than 0 when using fixed encashment";
  }

  if (data.minServiceDaysForEligibility < 0) {
    errors.minServiceDaysForEligibility = "Minimum service days cannot be negative";
  }

  return errors;
}

/**
 * Calculate leave rule KPIs from a list of rules.
 */
export function calculateLeaveRuleKPIs(rules: LeaveRule[]): LeaveRuleKPIs {
  return {
    total: rules.length,
    statutory: rules.filter((r) => r.ruleCategory === "STATUTORY").length,
    company: rules.filter((r) => r.ruleCategory === "COMPANY").length,
    active: rules.filter((r) => r.isActive).length,
  };
}

/**
 * Format accrual method for display.
 */
export function formatAccrualMethod(method: AccrualMethod): string {
  switch (method) {
    case "FIXED_ANNUAL":
      return "Fixed Annual";
    case "DAYS_WORKED":
      return "Per Days Worked";
    case "MONTHLY_ACCRUAL":
      return "Monthly Accrual";
    default:
      return method;
  }
}

/**
 * Format accrual value for display based on method.
 */
export function formatAccrualValue(value: number, method: AccrualMethod): string {
  switch (method) {
    case "FIXED_ANNUAL":
      return `${value} days/year`;
    case "DAYS_WORKED":
      return `1 day per ${value} days worked`;
    case "MONTHLY_ACCRUAL":
      return `${value} days/month`;
    default:
      return `${value}`;
  }
}

/**
 * Format encashment rate for display.
 */
export function formatEncashmentRate(rate: string, fixedAmount?: number): string {
  if (rate === "BASIC_DAILY") {
    return "Basic Salary / 30 per day";
  }
  if (rate === "FIXED_AMOUNT" && fixedAmount) {
    return `NPR ${fixedAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/day`;
  }
  return "—";
}

/**
 * Format rule category for display.
 */
export function formatRuleCategory(category: LeaveRuleCategory): string {
  return category === "STATUTORY" ? "Statutory" : "Company";
}

/**
 * Calculate accrued leave days based on method.
 * @param accrualMethod The accrual method
 * @param accrualValue The value for accrual calculation
 * @param daysWorked Total days worked in the period
 * @param monthsWorked Total months worked in the period
 */
export function calculateAccruedDays(
  accrualMethod: AccrualMethod,
  accrualValue: number,
  daysWorked: number,
  monthsWorked: number,
): number {
  switch (accrualMethod) {
    case "FIXED_ANNUAL":
      return accrualValue;
    case "DAYS_WORKED":
      // 1 day per X days worked (e.g. Home Leave: 1 day per 20 days worked)
      return Math.floor(daysWorked / accrualValue);
    case "MONTHLY_ACCRUAL":
      return accrualValue * monthsWorked;
    default:
      return 0;
  }
}

/**
 * Calculate leave encashment amount.
 * Nepal Labour Act: encashment based on "basic remuneration" = Basic Salary only.
 * Formula: excessDays * (basicSalary / 30)
 */
export function calculateEncashmentAmount(
  excessDays: number,
  basicSalary: number,
): number {
  if (excessDays <= 0 || basicSalary <= 0) return 0;
  const dailyRate = basicSalary / 30;
  return Math.round(excessDays * dailyRate * 100) / 100;
}
