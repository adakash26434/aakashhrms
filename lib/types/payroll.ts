export type PayrollRunStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'LOCKED';
export type LeaveSalaryRunStatus = 'DRAFT' | 'PAID';
export type EncashmentType = 'ANNUAL_EXCESS' | 'TERMINATION' | 'VOLUNTARY';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';

export interface PayrollRun {
  id: string;
  fiscalYearId: string;
  payPeriodMonth: number;
  payPeriodYear: number;
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
  notes: string | null;
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
  bankAccountNumber: string;
  bankName: string;
  payslipMonth: number | null;
  payslipDate: string | null;
  status: 'DRAFT' | 'LOCKED';
  isYearEndReconciliation: boolean;
  warnings: string | null;
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

export interface LeaveSalaryRun {
  id: string;
  payrollRunId: string | null;
  employeeId: string;
  leaveTypeId: string;
  leaveDays: string;
  perDayRate: string;
  totalAmount: string;
  tdsAmount: string | null;
  encashmentType: EncashmentType;
  paymentPeriod: string; // "BS YYYY-MM"
  paymentMethod: PaymentMethod;
  status: LeaveSalaryRunStatus;
  createdBy: string;
  createdByName?: string | null;
  approvedBy: string | null;
  approvedByName?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface PayrollSlipOverridePayload {
  slipId: string;
  headId?: string; // The specific pay head override (if applicable)
  amount?: string;
  reason?: string;
  basicSalary?: string;
  gradeAmount?: string;
  otAmount?: string;
  absentDeduction?: string;
  bankName?: string;
  bankAccountNumber?: string;
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

export interface LeaveSalarySetupPayload {
  paymentPeriod: string; // YYYY-MM
  employeeId: string;
  leaveTypeId: string;
  leaveDays: number;
  encashmentType: EncashmentType;
  paymentMethod?: PaymentMethod;
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
}
