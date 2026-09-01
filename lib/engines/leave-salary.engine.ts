import Decimal from "decimal.js";

/**
 * Calculates leave salary/encashment.
 *
 * Supports two encashment rate modes (from leaveRules table):
 *  - BASIC_DAILY (default): dailyRate = basicSalary / workingDays
 *  - FIXED_AMOUNT:          dailyRate = fixedDailyAmount
 *
 * Nepal Labour Act standard: leave encashment based on basic salary only.
 * The gradeAmount parameter has been removed (ARCH-1 fix) — grade is not
 * part of "basic remuneration" for encashment purposes.
 */
export function calculateLeaveSalary(args: {
  basicSalary: string;
  leaveDays: number;
  workingDays?: number;
  encashmentRate?: 'BASIC_DAILY' | 'FIXED_AMOUNT';
  fixedDailyAmount?: number;
}): {
  perDayRate: string;
  totalAmount: string;
} {
  const days = new Decimal(args.leaveDays);
  const workDays = new Decimal(args.workingDays ?? 30);

  let dailyRate: Decimal;

  if (args.encashmentRate === 'FIXED_AMOUNT' && args.fixedDailyAmount) {
    dailyRate = new Decimal(args.fixedDailyAmount);
  } else {
    // Default: BASIC_DAILY — Nepal Labour Act standard
    dailyRate = new Decimal(args.basicSalary).dividedBy(workDays);
  }

  const total = dailyRate.times(days).toDecimalPlaces(2);

  return {
    perDayRate: dailyRate.toDecimalPlaces(2).toString(),
    totalAmount: total.toString(),
  };
}

/**
 * Validates an encashment request against balance and caps.
 * Returns an error message string if validation fails, or null if valid.
 *
 * Nepal Labour Act 2074 rules:
 *  - Excess home leave (beyond 90 accumulated days) must be encashed annually
 *  - Accumulated unused home leave up to 90 days encashed at termination
 *  - Accumulated unused sick leave up to 45 days encashed at termination
 */
export function validateEncashmentRequest(args: {
  leaveDays: number;
  availableBalance: number;
  accumulationCap: number | null;
  maxPaidDays: number | null;
}): string | null {
  // Cannot encash more than available
  if (args.leaveDays > args.availableBalance) {
    return `Cannot encash ${args.leaveDays} days. Available balance: ${args.availableBalance} days.`;
  }

  // Cannot encash more than maxPaidDays (e.g., maternity 60 paid days)
  if (args.maxPaidDays !== null && args.leaveDays > args.maxPaidDays) {
    return `Maximum encashable days for this leave type is ${args.maxPaidDays}.`;
  }

  return null;
}
