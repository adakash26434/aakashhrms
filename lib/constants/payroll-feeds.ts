// Payroll feeds (4.8): one-off lines a pay run adds from other modules' records. Their amounts
// come from those records, so a payslip never types them, they never become part of anyone's
// salary structure, and recalculating a payslip reads them again from the same records.

export const TADA_HEAD_CODE = "TADA";
export const WELFARE_FUND_HEAD_CODE = "WELFARE_FUND";
export const ARREARS_HEAD_CODE = "ARREARS";
/** F16: approved reimbursements, on the head their type's taxability says. */
export const REIMBURSE_HEAD_CODE = "REIMBURSE";
export const REIMBURSE_TAXABLE_HEAD_CODE = "REIMBURSE_TAX";
/** 4.9: approved leave salary (taxable). */
export const LEAVE_ENCASH_HEAD_CODE = "LEAVE_ENCASH";

export const FEED_HEAD_CODES: readonly string[] = [TADA_HEAD_CODE, WELFARE_FUND_HEAD_CODE, ARREARS_HEAD_CODE, REIMBURSE_HEAD_CODE, REIMBURSE_TAXABLE_HEAD_CODE, LEAVE_ENCASH_HEAD_CODE];

/** Where each feed line's amount comes from: said when someone tries to type or add it. */
export const FEED_SOURCE: Readonly<Record<string, string>> = {
  [TADA_HEAD_CODE]: "approved travel claims (Payroll → Travel / TA-DA)",
  [WELFARE_FUND_HEAD_CODE]: "the month's welfare-fund contributions (Payroll → Welfare funds)",
  [ARREARS_HEAD_CODE]: "back-dated salary revisions (Salary structure)",
  [REIMBURSE_HEAD_CODE]: "approved reimbursement claims (Payroll → Reimbursements)",
  [REIMBURSE_TAXABLE_HEAD_CODE]: "approved reimbursement claims (Payroll → Reimbursements)",
  [LEAVE_ENCASH_HEAD_CODE]: "approved leave salary (Payroll → Leave salary)",
};

export const isFeedHeadCode = (code: string | null | undefined): boolean => !!code && FEED_HEAD_CODES.includes(code);

/**
 * Taxable lines a payslip pays once (not every month): the tax projection adds them to the year
 * once instead of multiplying them by the months that remain (4.9).
 */
export const ONE_OFF_TAXABLE_HEAD_CODES: readonly string[] = [ARREARS_HEAD_CODE, REIMBURSE_TAXABLE_HEAD_CODE, LEAVE_ENCASH_HEAD_CODE];
