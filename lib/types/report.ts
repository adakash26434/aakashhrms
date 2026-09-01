import type { PayrollSlip, PayrollSlipHead } from "./payroll";

// ─── Shared ────────────────────────────────────────────────────────────────

export interface ReportPayrollRunOption {
  id: string;
  label: string; // e.g. "Mangsir 2081 (LOCKED)"
  payPeriodMonth: number;
  payPeriodYear: number;
  status: string;
  employeeCount: number;
  totalNetPayable: string;
}

export interface ReportFilterLookupData {
  fiscalYears: { id: string; label: string; status: string }[];
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  lockedPayrollRuns: ReportPayrollRunOption[]; // Only LOCKED runs
  leaveTypes: { id: string; name: string; code: string }[];
  loanTypes: { id: string; name: string }[];
  employees: { id: string; name: string; employeeCode: string }[];
}

// ─── Salary Sheet ──────────────────────────────────────────────────────────

export interface SalarySheetFilter {
  payrollRunId: string; // Required — must select a specific LOCKED run
  branchId?: string; // Optional filter
  departmentId?: string; // Optional filter
  employeeSearch?: string; // Optional name/code search
}

export interface SalarySheetRow {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  basicSalary: string;
  gradeAmount: string;
  otAmount: string;
  allowanceHeads: { name: string; amount: string }[]; // Dynamic — varies by employee
  grossEarnings: string;
  absentDeduction: string;
  pfEmployee: string;
  tdsThisMonth: string;
  ssfEmployee: string;
  citDeduction: string;
  loanDeduction: string;
  deductionHeads: { name: string; amount: string }[]; // Dynamic deduction heads
  totalDeductions: string;
  netPayable: string;
  bankName: string;
  bankAccountNumberMasked: string; // Last 4 digits only: "****2345"
  bankAccountNumberFull: string; // Full — for CSV export only
}

export interface SalarySheetSummary {
  totalEmployees: number;
  totalGrossEarnings: string;
  totalDeductions: string;
  totalNetPayable: string;
  totalTds: string;
  totalPf: string;
  totalSsf: string;
  totalCit: string;
  totalLoanDeductions: string;
}

export interface SalarySheetReportData {
  run: ReportPayrollRunOption;
  rows: SalarySheetRow[];
  summary: SalarySheetSummary;
  allAllowanceHeadNames: string[]; // For dynamic column headers
  allDeductionHeadNames: string[]; // For dynamic column headers
}

// ─── Payslip Report ────────────────────────────────────────────────────────

export interface PayslipFilter {
  payrollRunId: string; // Required
  employeeId?: string; // If provided: single employee; if absent: all employees in run
}

export interface PayslipPrintData {
  run: ReportPayrollRunOption;
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
}

// ─── Payslip Head Summary Report ──────────────────────────────────────────

export interface PayslipHeadSummaryRow {
  payHeadName: string;
  headType: "allowance" | "deduction";
  totalAmount: string;
  employeeCount: number;
  averageAmount: string;
  overrideCount: number; // How many manual overrides for this head
}

// ─── Attendance Report ─────────────────────────────────────────────────────

export type AttendanceReportFormat = "DEVICE_PUNCH" | "STATUS_MATRIX" | "STATUTORY_SUMMARY";

export interface AttendanceReportFilter {
  fiscalYearId: string;
  bsMonth: number; // 1-12
  fromBsMonth?: number;
  toBsMonth?: number;
  reportFormat?: AttendanceReportFormat;
  branchId?: string;
  departmentId?: string;
  designationId?: string;
  employeeId?: string;
}

export interface AttendanceDailyDetail {
  dateStr: string; // e.g. "2081-08-01"
  dayNum: number; // 1, 2, 3...
  inTime?: string; // "10:00 AM"
  outTime?: string; // "05:45 PM"
  workHours?: string; // "07:45"
  statusCode?: string; // "P", "A", "L", "HD", "LWOP", "HO", "OFF"
}

export interface AttendanceReportRow {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  totalWorkingDays: string;
  presentDays: string;
  payLeaveDays: string;
  nonPayLeaveDays: string;
  absentDays: string;
  totalOtHoursOffice: string;
  totalOtHoursOff: string;
  otEarnedAmount: string;
  leaveDeductionAmount: string;
  totalWorkHours?: string;
  dailyDetails?: AttendanceDailyDetail[];
}

export interface AttendanceReportData {
  monthLabel: string; // "Mangsir 2081"
  fiscalYearLabel: string; // "2081/82"
  reportFormat: AttendanceReportFormat;
  dateHeaders: { dateStr: string; dateStrAD: string; dayNum: number; dayName: string }[];
  rows: AttendanceReportRow[];
  totalEmployees: number;
  isLocked: boolean;
}

// ─── TDS / IRD Report ─────────────────────────────────────────────────────

export type TDSReportType = "MONTHLY" | "ANNUAL";

export interface TDSReportFilter {
  fiscalYearId: string;
  reportType: TDSReportType;
  bsMonth?: number; // Required when reportType = 'MONTHLY'
}

export interface TDSReportRow {
  employeeCode: string;
  employeeName: string;
  panNumber: string | null; // null if not entered — show "N/A" in display
  taxStatus: string; // From employee.taxStatus
  grossIncome: string; // For the selected period
  pfDeducted: string;
  citDeducted: string;
  taxableIncome: string;
  tdsDeducted: string;
  period: string; // "Mangsir 2081" or "FY 2081/82"
}

export interface TDSReportData {
  rows: TDSReportRow[];
  period: string;
  fiscalYearLabel: string;
  totalTds: string;
  totalGrossIncome: string;
  employeesWithoutPAN: number; // Count of rows where panNumber is null
}

// ─── Leave Report ─────────────────────────────────────────────────────────

export interface LeaveReportFilter {
  fiscalYearId: string;
  leaveTypeId?: string;
  branchId?: string;
  departmentId?: string;
  employeeSearch?: string;
}

export interface LeaveBalanceRow {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  isStatutory: boolean;
  allotted: string;
  taken: string;
  carriedForward: string;
  balance: string;
  isEncashable: boolean;
}

export interface LeaveApplicationReportRow {
  id: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  leaveTypeName: string;
  appliedDate: string;
  effectiveFrom: string;
  effectiveTo: string;
  duration: string;
  noOfDays: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
}

export interface LeaveReportData {
  fiscalYearLabel: string;
  balanceRows: LeaveBalanceRow[];
  applicationRows: LeaveApplicationReportRow[];
  totalEmployees: number;
  totalDaysTaken: string;
  totalDaysAllotted: string;
  totalEncashableBalance: string;
}

// ─── Loan Report ──────────────────────────────────────────────────────────

export type LoanReportStatus = "ALL" | "ACTIVE" | "CLOSED";

export interface LoanReportFilter {
  status?: LoanReportStatus;
  loanTypeId?: string;
  branchId?: string;
  departmentId?: string;
  employeeSearch?: string;
}

export interface LoanSummaryRow {
  loanId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  loanTypeName: string;
  givenDate: string;
  loanAmount: string;
  installmentAmount: string;
  noOfInstallments: number;
  totalReturned: string;
  remainingAmount: string;
  status: "ACTIVE" | "CLOSED";
}

export interface LoanRepaymentLedgerRow {
  repaymentId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  loanTypeName: string;
  repaymentDate: string;
  amountPaid: string;
  paymentMethod: "CASH" | "SALARY_DEDUCTION";
  payrollRunLabel?: string;
}

export interface LoanReportData {
  summaryRows: LoanSummaryRow[];
  repaymentRows: LoanRepaymentLedgerRow[];
  totalLoansCount: number;
  activeLoansCount: number;
  totalDisbursedAmount: string;
  totalReturnedAmount: string;
  totalRemainingBalance: string;
}

