// Reports (4.11, template D): what each report screen receives. Every report is built on the
// server within the viewer's employee scope (S48); the page shows it as A4 paper and exports the
// same rows.

/** The letterhead: the company's details and its letter design (logo, alignment, rule). */
export interface ReportCompany {
  name: string;
  address: string;
  pan: string;
  regNo?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string;
  headerAlign?: "center" | "left";
  ruleStyle?: "brand" | "line" | "none";
}

export interface ReportOption {
  value: string;
  label: string;
}

/** Shared by every report: the letterhead, who generated it and for which part of the company. */
export interface ReportContext {
  company: ReportCompany;
  generatedBy: string;
  /** BS date and Nepal time, e.g. "2083-06-24 10:42". */
  generatedOn: string;
  /** "All branches", or the branches / departments the viewer covers. */
  scopeLabel: string;
  /** Only some branches or departments are included. */
  partialScope: boolean;
  /** The viewer may download Excel / CSV (EXPORT on the report). */
  canExport: boolean;
}

/** Branch, department and employee choices — only those within the viewer's scope. */
export interface ReportPlaces {
  branches: ReportOption[];
  departments: ReportOption[];
  employees: ReportOption[];
}

export interface ReportPeriods {
  fiscalYears: ReportOption[];
  /** Each fiscal year's BS months in order (Shrawan first), value "YYYY-MM", by fiscal year id. */
  months: Record<string, ReportOption[]>;
}

// ---------------------------------------------------------------------------
// Salary sheet (REPORTS_SALARY_SHEET)
// ---------------------------------------------------------------------------

export const SALARY_VIEWS = ["sheet", "summary", "lines", "bank"] as const;
export type SalaryView = (typeof SALARY_VIEWS)[number];
export const SALARY_GROUPS = ["none", "department", "branch"] as const;
export type SalaryGroupBy = (typeof SALARY_GROUPS)[number];

export interface SalaryParams {
  runId: string;
  view: SalaryView;
  groupBy: SalaryGroupBy;
  branchId: string;
  departmentId: string;
  employeeId: string;
}

/** An approved or locked run with payslips in the viewer's scope. */
export interface ReportRunOption {
  value: string;
  label: string;
  status: "APPROVED" | "LOCKED";
}

export interface RunSignOff {
  name: string;
  /** BS date. */
  on: string;
}

export interface ReportRun {
  id: string;
  /** "Aswin 2083". */
  period: string;
  /** "Regular salary", "Festival allowance"… */
  kind: string;
  /** Branches the run covers ("" = every branch). */
  branches: string;
  status: "APPROVED" | "LOCKED";
  prepared: RunSignOff | null;
  checked: RunSignOff | null;
  approved: RunSignOff | null;
  /** BS date the run was locked. */
  lockedOn: string | null;
}

/** One pay line as a salary-sheet column: basic, grade, a pay head, OT, absence, loan. */
export interface SalaryLineColumn {
  key: string;
  label: string;
  labelNp: string | null;
  side: "earning" | "deduction";
}

export interface SalarySheetRow {
  slipId: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  /** Amount per line key (missing = nothing on that line). */
  lines: Record<string, string>;
  gross: string;
  totalDeductions: string;
  net: string;
  /** Summary columns. */
  basicGrade: string;
  allowances: string;
  retirement: string;
  tax: string;
  loan: string;
  otherDeductions: string;
  /** A line was typed by a reviewer instead of calculated. */
  adjusted: boolean;
  /** The lines add up to the stored totals (to the paisa). */
  balanced: boolean;
}

/** A pay line across the run: how many were paid it, the total and the average. */
export interface SalaryLineRow {
  key: string;
  label: string;
  labelNp: string | null;
  side: "earning" | "deduction";
  employees: number;
  total: string;
  average: string;
  adjusted: number;
}

export interface BankTransferRow {
  slipId: string;
  code: string;
  name: string;
  bank: string;
  account: string;
  net: string;
}

export interface CompanySignatory {
  name: string;
  title: string;
}

export interface SalarySheetData {
  context: ReportContext;
  params: SalaryParams;
  runs: ReportRunOption[];
  places: ReportPlaces;
  run: ReportRun | null;
  /** Payslips in the report (the viewer's employees, narrowed by the parameters). */
  employees: number;
  /** The detailed sheet's pay-line columns, in payslip order. */
  columns: SalaryLineColumn[];
  rows: SalarySheetRow[];
  lines: SalaryLineRow[];
  bank: BankTransferRow[];
  signatories: CompanySignatory[];
}

// ---------------------------------------------------------------------------
// Payslips (REPORTS_PAYSLIP)
// ---------------------------------------------------------------------------

export interface PayslipReportParams {
  runId: string;
  branchId: string;
  departmentId: string;
  employeeId: string;
}

export interface PayslipReportData {
  context: ReportContext;
  params: PayslipReportParams;
  runs: ReportRunOption[];
  places: ReportPlaces;
  run: ReportRun | null;
  sheets: import("@/lib/types/payslip-sheet").PayslipSheetData[];
}

// ---------------------------------------------------------------------------
// Attendance (REPORTS_ATTENDANCE)
// ---------------------------------------------------------------------------

export const ATTENDANCE_VIEWS = ["summary", "register", "cards"] as const;
export type AttendanceView = (typeof ATTENDANCE_VIEWS)[number];

export interface AttendanceParams {
  fiscalYearId: string;
  /** BS "YYYY-MM". */
  month: string;
  view: AttendanceView;
  branchId: string;
  departmentId: string;
  employeeId: string;
}

export interface AttendanceDayCell {
  /** BS day of the month. */
  day: number;
  code: string;
  type: string;
  in: string | null;
  out: string | null;
  /** "7:45" worked. */
  worked: string | null;
  note: string | null;
}

export interface AttendanceReportRow {
  employeeId: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  employedDays: number;
  payableDays: number;
  present: number;
  halfDays: number;
  onDuty: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  missingPunch: number;
  holidays: number;
  weeklyOff: number;
  lateDays: number;
  otWorkDayHours: number;
  otOffDayHours: number;
  workedHours: number;
  /** Pay effect — only for viewers who can see the salary sheet. */
  otPay: string | null;
  absenceDeduction: string | null;
  days: AttendanceDayCell[];
}

export interface AttendanceReportData {
  context: ReportContext;
  params: AttendanceParams;
  periods: ReportPeriods;
  places: ReportPlaces;
  /** "Aswin 2083". */
  monthLabel: string;
  /** Day headers: BS day and weekday ("Sun"). */
  dayHeads: { day: number; weekday: string; ad: string }[];
  rows: AttendanceReportRow[];
  /** Every person's month is closed for payroll. */
  closed: boolean;
  showAmounts: boolean;
}

// ---------------------------------------------------------------------------
// Leave (REPORTS_LEAVE)
// ---------------------------------------------------------------------------

export const LEAVE_VIEWS = ["balances", "movements", "taken", "requests"] as const;
export type LeaveView = (typeof LEAVE_VIEWS)[number];
export const LEAVE_REQUEST_STATUSES = ["all", "Pending", "Approved", "Rejected", "Cancelled"] as const;
export type LeaveRequestStatusFilter = (typeof LEAVE_REQUEST_STATUSES)[number];

export interface LeaveReportParams {
  fiscalYearId: string;
  view: LeaveView;
  leaveTypeId: string;
  status: LeaveRequestStatusFilter;
  branchId: string;
  departmentId: string;
  employeeId: string;
  reasons: boolean;
}

export interface LeaveTypeColumn {
  id: string;
  name: string;
}

export interface LeaveBalanceRow {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  branch: string;
  /** Available days per leave type id (missing = the type does not apply). */
  balances: Record<string, number>;
}

export interface LeaveMovementRow {
  key: string;
  code: string;
  name: string;
  leaveType: string;
  broughtForward: number;
  earned: number;
  taken: number;
  adjusted: number;
  paidOut: number;
  expired: number;
  available: number;
}

export interface LeaveRequestReportRow {
  id: string;
  code: string;
  name: string;
  leaveType: string;
  /** BS dates. */
  applied: string;
  from: string;
  to: string;
  days: number;
  paidDays: number;
  unpaidDays: number;
  status: string;
  decidedBy: string;
  reason: string | null;
}

export interface LeaveReportData {
  context: ReportContext;
  params: LeaveReportParams;
  years: ReportOption[];
  types: ReportOption[];
  places: ReportPlaces;
  yearLabel: string;
  /** Balances are as of this BS date (today, or the year's last day once it has ended). */
  asOf: string;
  balanceTypes: LeaveTypeColumn[];
  balances: LeaveBalanceRow[];
  movements: LeaveMovementRow[];
  requests: LeaveRequestReportRow[];
}

// ---------------------------------------------------------------------------
// Loans (REPORTS_LOAN)
// ---------------------------------------------------------------------------

export const LOAN_VIEWS = ["loans", "repayments", "given"] as const;
export type LoanReportView = (typeof LOAN_VIEWS)[number];
export const LOAN_STATUS_FILTERS = ["running", "closed", "all"] as const;
export type LoanStatusFilter = (typeof LOAN_STATUS_FILTERS)[number];

export interface LoanReportParams {
  view: LoanReportView;
  status: LoanStatusFilter;
  fiscalYearId: string;
  /** BS "YYYY-MM" or "" for the whole year (repayments and loans given). */
  month: string;
  loanTypeId: string;
  branchId: string;
  departmentId: string;
  employeeId: string;
}

export interface LoanReportRow {
  loanId: string;
  code: string;
  name: string;
  loanType: string;
  /** BS date given. */
  given: string;
  amount: string;
  interest: string;
  totalPayable: string;
  repaid: string;
  writtenOff: string;
  balance: string;
  installment: string;
  installmentsLeft: number | null;
  status: string;
  paidVia: string;
  reference: string;
  source: "disbursed" | "opening";
}

export interface LoanRepaymentReportRow {
  id: string;
  /** BS date. */
  date: string;
  code: string;
  name: string;
  loanType: string;
  amount: string;
  how: string;
  note: string;
}

export interface LoanReportData {
  context: ReportContext;
  params: LoanReportParams;
  periods: ReportPeriods;
  types: ReportOption[];
  places: ReportPlaces;
  /** "FY 2083/84" or "Aswin 2083". */
  periodLabel: string;
  loans: LoanReportRow[];
  repayments: LoanRepaymentReportRow[];
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

export interface ReportCatalogueItem {
  id: string;
  title: string;
  description: string;
  href: string;
  group: "payroll" | "time" | "people";
}
