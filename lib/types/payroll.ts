export type PayrollRunStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'LOCKED';

/** 4.8b: income paid so far this fiscal year (LOCKED payslips only), the base of the tax projection. */
export interface YtdFigures {
  taxableGross: string;
  /** PF + SSF, employee and employer sides. */
  retirement: string;
  cit: string;
  tds: string;
  /** Payslips counted. */
  months: number;
}

/** 4.8b: how a payslip's income tax was projected (kept on the slip; the payslip pane shows it). */
export interface TaxDetail {
  method: 'ytd' | 'flat15' | 'none';
  monthsRemaining: number;
  ytd: YtdFigures;
  month: { taxableGross: string; oneOffTaxable: string; retirement: string; cit: string; insuranceAnnual: string };
  projected: { gross: string; retirement: string; cit: string; taxable: string };
  annualTax: string;
  tdsThisMonth: string;
}

/** 4.8a: one welfare fund's contribution on a payslip (the employee share is deducted). */
export interface FundLine {
  code: string;
  name: string;
  employeeAmount: string;
  employerAmount: string;
}

export interface PayrollRun {
  id: string;
  fiscalYearId: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  /** F6: REGULAR | FESTIVAL | ARREARS (lib/engines/off-cycle.engine.ts). */
  runType: string;
  payPeriodStartDate: string; // YYYY-MM-DD
  payPeriodEndDate: string;   // YYYY-MM-DD
  branchIds: string[];
  departmentIds: string[] | null;
  designationIds: string[];
  employeeCategories: string[];
  employeeIds: string[];
  occasionalAllowanceHeadIds: string[];
  payslipMonth: number | null;
  payslipDate: string | null;
  status: PayrollRunStatus;
  totalGross: string;
  totalDeductions: string;
  totalNetPayable: string;
  totalTds: string;
  totalPf: string;
  totalSsf: string;
  employeeCount: number;
  generatedBy: string;
  generatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  lockedAt: Date | null;
  /** F3: set when the run is published to employees (only a locked run can be). */
  publishedAt?: Date | null;
  publishedBy?: string | null;
  notes: string | null;
  /** 4.8b: the calendar of pay_period_year / pay_period_month ("BS" | "AD"). */
  calendar: string;
  /** 4.8a: the approval flow copied on at submission. */
  approvalType: string | null;
  approvalLevels: { level: number; userId: string; skipped?: 'preparer' | 'own_salary' | null }[];
  currentLevel: number;
  approvalRoute: string | null;
  variance: import('@/lib/types/payroll-run').RunVariance | null;
  submittedBy: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollSlip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  basicSalary: string;
  gradeAmount: string;
  grossEarnings: string;
  totalDeductions: string;
  netPayable: string;
  taxableIncome: string;
  tdsThisMonth: string;
  pfEmployee: string;
  pfEmployer: string;
  ssfEmployee: string;
  ssfEmployer: string;
  citDeduction: string;
  loanDeduction: string;
  absentDeduction: string;
  otAmount: string;
  /** 4.7b: how otAmount was worked out (hours, hourly rate, rates); null on older slips. */
  otDetail?: import('@/lib/types/overtime').OvertimeDetail | null;
  /** 4.8a: welfare fund contributions deducted this month, and the detail per fund. */
  fundDeduction?: string;
  fundDetail?: FundLine[] | null;
  bankAccountNumber: string;
  bankName: string;
  /** F5: the tax computation behind the TDS (months 1–11); validated with `isTaxSheet` before use. */
  taxSheet?: unknown;
  payslipMonth: number | null;
  payslipDate: string | null;
  status: 'DRAFT' | 'LOCKED';
  isYearEndReconciliation: boolean;
  warnings: string | null;
  /** F3: a held payslip stays hidden from the employee. */
  heldAt?: Date | null;
  holdReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollSlipHead {
  id: string;
  payrollSlipId: string;
  payHeadId: string;
  payHeadName: string;
  headType: 'allowance' | 'deduction';
  amount: string;
  calculatedAmount: string;
  isManualOverride: boolean;
  overrideReason: string | null;
}

// -----------------------------------------------------------------------------
// Form Data & Payloads
// -----------------------------------------------------------------------------

export interface PayrollRunSetupPayload {
  payPeriodMonth: number; // 1-12
  payPeriodYear: number;
  branchIds: string[];
  departmentIds: string[] | null;
  designationIds: string[] | null;
  employeeCategories: string[] | null;
  employeeIds: string[] | null;
  occasionalAllowanceHeadIds: string[] | null;
  payslipMonth: number | null;
  payslipDate: string | null;
  includeFestivalAllowance?: boolean; // Keep for fallback compatibility
  includeRemoteAllowance?: boolean;   // Keep for fallback compatibility
  recreateIfExists?: boolean;         // Discard existing draft and regenerate if true
  /** F6: REGULAR (default) | FESTIVAL | ARREARS (lib/constants/run-types.ts). */
  runType?: import('@/lib/constants/run-types').RunType;
  /** F6 festival runs: pay in proportion for service under a year (Labour Act §37); default true. */
  prorateFestival?: boolean;
}

export interface AddSlipHeadPayload {
  slipId: string;
  payHeadId: string;
  amount: string;
  reason: string;
}

export interface PayrollSlipOverridePayload {
  slipId: string;
  headId?: string; // The specific pay head override (if applicable)
  amount?: string;
  reason?: string;
  basicSalary?: string;
  gradeAmount?: string;
  otAmount?: string;
  /** 4.7b: kept with the attendance figures when they are read again. */
  otDetail?: import('@/lib/types/overtime').OvertimeDetail | null;
  absentDeduction?: string;
  loanDeduction?: string;
}

export interface ManualSlipAdjustmentPayload {
  employeeId: string;
  basicSalary?: string;
  gradeAmount?: string;
  grossEarnings?: string;
  totalDeductions?: string;
  netPayable?: string;
  taxableIncome?: string;
  tdsThisMonth?: string;
  pfEmployee?: string;
  pfEmployer?: string;
  ssfEmployee?: string;
  ssfEmployer?: string;
  citDeduction?: string;
  loanDeduction?: string;
  absentDeduction?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

// -----------------------------------------------------------------------------
// Computation Structures
// -----------------------------------------------------------------------------

export interface SlabTaxDetail {
  slabFrom: string;
  slabTo: string | null;
  ratePercent: string;
  incomeInSlab: string;
  taxAmount: string;
}

export interface TDSCalculation {
  projectedAnnualGross: string;
  projectedAnnualBasicGrade: string;
  pfAnnual: string;
  citAnnual: string;
  insuranceDeduction: string;
  totalDeductions: string;
  taxableIncome: string;
  annualTaxRaw: string;
  womenTaxDiscountAmount: string;
  handicappedTaxDeductionAmount: string;
  finalAnnualTax: string;
  monthlyTds: string;
  slabDetails: SlabTaxDetail[];
  isYearEndReconciliation: boolean;
}

export interface PayrollCalculationResult {
  basicSalary: string;
  gradeAmount: string;
  grossEarnings: string;
  totalDeductions: string;
  netPayable: string;
  taxableIncome: string;
  tdsThisMonth: string;
  pfEmployee: string;
  pfEmployer: string;
  ssfEmployee: string;
  ssfEmployer: string;
  citDeduction: string;
  loanDeduction: string;
  absentDeduction: string;
  otAmount: string;
  heads: Array<{
    payHeadId: string;
    payHeadName: string;
    headType: 'allowance' | 'deduction';
    amount: string;
    calculatedAmount: string;
  }>;
  /** F5: the tax computation behind this month's TDS (months 1–11, when history was supplied). */
  taxSheet?: import('@/lib/engines/tax-projection.engine').TaxSheet;
}
