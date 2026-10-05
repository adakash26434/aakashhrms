import type { EmployeeCategory, GradePolicySettings } from "./system-control";

export type EmployeeStatus = "Active" | "Inactive";
/**
 * Tax status aligned with Nepal IRD tax slab categories.
 * These values MUST match the `category` field in `tax_rate_slabs` table.
 * The "Handicapped" slab category is handled via the `isDisabled` boolean flag.
 */
export type TaxStatus = "Normal Single" | "Married" | "Widow";
export type TerminationType = "Retirement" | "Resignation" | "Termination" | "Contract End";
export type TerminationPlan = "Upadan" | "Gratuity" | "Pension" | "None";

export interface Employee {
  id: string;
  // General Info
  attendanceCode: string;
  employeeCode: string;
  fullName: string;
  gender: "Male" | "Female" | "Other";
  dateOfBirth: Date;
  taxStatus: TaxStatus;
  isDisabled: boolean;

  // Office Info
  category: EmployeeCategory;
  shreni: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  supervisorId: string | null;
  isSupervisor: boolean;
  joiningDate: Date;
  confirmationDate: Date | null;
  status: EmployeeStatus;
  basicSalary?: number;
  gradePercent: number;
  gradeCount?: number;
  gradeAmount: number;
  /** Grade amount typed by hand instead of worked out by the grade policy. */
  gradeManual?: boolean;

  // Personal Info
  citizenshipNo: string;
  issuingDistrict: string;
  nidNo: string | null;
  nidIssuingDistrict: string | null;
  passportNo: string | null;
  passportIssuingDistrict: string | null;
  votersId: string | null;
  voterIdIssuingDistrict: string | null;
  panNumber?: string | null;
  phoneHome: string | null;
  mobileNo: string;
  email: string;
  companyEmail: string;
  personalEmail: string | null;
  permanentAddress?: string;
  temporaryAddress?: string | null;
  address1?: string;
  address2?: string | null;

  // Family Info
  fatherName: string | null;
  motherName: string | null;
  spouseName: string | null;
  grandfatherName: string | null;

  // Bank & Termination
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  informedDate: Date | null;
  terminationDate: Date | null;
  terminationType: TerminationType | null;
  terminationReason: string | null;
  terminationPlan: TerminationPlan | null;
  terminationRemarks: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/** 
 * Form-specific type. 
 * Dates are strings here because they come from HTML inputs/pickers.
 */
export interface EmployeeFormData {
  attendanceCode: string;
  employeeCode: string;
  fullName: string;
  gender: "Male" | "Female" | "Other";
  dateOfBirth: string; 
  taxStatus: TaxStatus;
  isDisabled: boolean;

  category: EmployeeCategory;
  shreni: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  supervisorId: string;
  isSupervisor: boolean;
  joiningDate: string;
  confirmationDate: string;
  status: EmployeeStatus;
  basicSalary?: number;
  gradePercent: number;
  gradeCount: number;
  gradeAmount: number;
  /** Grade amount typed by hand (needs Salary mapping → Edit); otherwise the policy works it out. */
  gradeManual: boolean;

  citizenshipNo: string;
  issuingDistrict: string;
  nidNo: string;
  nidIssuingDistrict: string;
  passportNo: string;
  passportIssuingDistrict: string;
  votersId: string;
  voterIdIssuingDistrict: string;
  panNumber: string;
  phoneHome: string;
  mobileNo: string;
  email: string;
  companyEmail: string;
  personalEmail: string;
  permanentAddress: string;
  temporaryAddress: string;
  address1?: string;
  address2?: string;

  fatherName: string;
  motherName: string;
  spouseName: string;
  grandfatherName: string;

  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  informedDate: string;
  terminationDate: string;
  terminationType: TerminationType | "";
  terminationReason: string;
  terminationPlan: TerminationPlan | "";
  terminationRemarks: string;
}

export interface EmployeeFilter {
  search: string;
  departmentId: string | "all";
  branchId: string | "all";
  category: EmployeeCategory | "all";
  status: EmployeeStatus | "all";
}

/** A record gap that stops the employee being paid or reported correctly. */
export type EmployeeRecordGap = "pan" | "bank" | "basic";

/**
 * One register row (S18): list columns only. Identity documents, family,
 * address and bank details never leave the server for the list.
 */
export interface EmployeeListRow {
  id: string;
  employeeCode: string;
  attendanceCode: string;
  fullName: string;
  gender: Employee["gender"];
  category: EmployeeCategory;
  status: EmployeeStatus;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationName: string;
  branchId: string;
  branchName: string;
  shreni: string;
  supervisorName: string | null;
  joiningDate: string;
  mobileNo: string;
  companyEmail: string;
  basicSalary: number;
  gradeAmount: number;
  /** Masked, e.g. "••••4821"; empty when there is no account. */
  bankAccountMasked: string;
  bankName: string;
  gaps: EmployeeRecordGap[];
}

export interface EmployeeRegisterData {
  rows: EmployeeListRow[];
  counts: { total: number; active: number; inactive: number; toFix: number };
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  permissions: { add: boolean; edit: boolean; export: boolean };
}

export interface EmployeeValidationErrors {
  attendanceCode?: string;
  employeeCode?: string;
  fullName?: string;
  gender?: string;
  dateOfBirth?: string;
  taxStatus?: string;
  isDisabled?: string;
  category?: string;
  shreni?: string;
  departmentId?: string;
  branchId?: string;
  designationId?: string;
  supervisorId?: string;
  isSupervisor?: string;
  joiningDate?: string;
  confirmationDate?: string;
  status?: string;
  gradePercent?: string;
  gradeCount?: string;
  gradeAmount?: string;
  citizenshipNo?: string;
  issuingDistrict?: string;
  nidNo?: string;
  nidIssuingDistrict?: string;
  passportNo?: string;
  passportIssuingDistrict?: string;
  votersId?: string;
  voterIdIssuingDistrict?: string;
  panNumber?: string;
  phoneHome?: string;
  mobileNo?: string;
  email?: string;
  companyEmail?: string;
  personalEmail?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  address1?: string;
  address2?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  grandfatherName?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  informedDate?: string;
  terminationDate?: string;
  terminationType?: string;
  terminationReason?: string;
  terminationPlan?: string;
  terminationRemarks?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Record page (4.2): /workforce/employees/[id]
// ---------------------------------------------------------------------------

export type EmployeeRecordTab = "overview" | "profile" | "leave" | "attendance" | "payslips" | "loans" | "history";

/** The employee as the record page shows it: names resolved, bank masked (S18). */
export interface EmployeeProfile extends Omit<Employee, "bankAccountNumber"> {
  bankAccountMasked: string;
  departmentName: string;
  designationName: string;
  branchName: string;
  supervisor: { id: string; name: string } | null;
  /** How the grade amount is set: "Typed by hand" or the grade policy in words. */
  gradeBasis: string;
  gaps: EmployeeRecordGap[];
  access: {
    email: string;
    roleName: string | null;
    state: "active" | "pending" | "disabled";
    lastLoginAt: Date | null;
  } | null;
}

export interface EmployeeLeaveTabData {
  fiscalYearLabel: string | null;
  balances: { leaveTypeName: string; allotted: number; carriedForward: number; taken: number; balance: number }[];
  requests: { id: string; leaveTypeName: string; from: string; to: string; days: number; status: string; appliedDate: string }[];
  /** Paid at the last basic salary if the employee left today (Labour Act §49; leave salary 4.9). */
  payable: { leaveTypeName: string; days: number; cap: number | null }[];
}

export interface EmployeeAttendanceDay {
  date: string;
  bsDay: number;
  weekday: number;
  status: string | null;
  inTime: string | null;
  outTime: string | null;
  workHours: number;
  isLate: boolean;
}

export interface EmployeeAttendanceTabData {
  monthLabel: string;
  days: EmployeeAttendanceDay[];
  totals: { present: number; absent: number; leave: number; halfDay: number; other: number; notRecorded: number };
}

export interface EmployeePayslipRow {
  id: string;
  year: number;
  month: number;
  periodLabel: string;
  gross: number;
  deductions: number;
  tds: number;
  ssf: number;
  net: number;
  status: string;
}

export interface EmployeeLoanRow {
  id: string;
  loanTypeName: string;
  givenDate: string;
  amount: number;
  installment: number;
  installments: number;
  returned: number;
  remaining: number;
  status: string;
}

export interface EmployeeHistoryRow {
  id: string;
  at: Date;
  userName: string | null;
  action: string;
  result: string;
  summary: string;
}

export type EmployeeRecordTabData =
  | { tab: "overview" }
  | { tab: "profile" }
  | { tab: "leave"; data: EmployeeLeaveTabData }
  | { tab: "attendance"; data: EmployeeAttendanceTabData }
  | { tab: "payslips"; data: EmployeePayslipRow[] }
  | { tab: "loans"; data: EmployeeLoanRow[] }
  | { tab: "history"; data: EmployeeHistoryRow[] };

/**
 * At-a-glance facts for the record page's FactBox pane. A key is undefined
 * when the user may not see that module, null when there is nothing yet.
 */
export interface EmployeeFacts {
  attendance?: { monthLabel: string; present: number; absent: number; leave: number; notRecorded: number } | null;
  leave?: { fiscalYearLabel: string | null; balance: number; types: { name: string; balance: number }[] } | null;
  lastPayslip?: { periodLabel: string; net: number; gross: number; status: string } | null;
  loans?: { active: number; outstanding: number } | null;
}

export interface EmployeeRecordData {
  /** Position in the register order, for the record navigator. */
  navigator: { position: number; total: number; prevId: string | null; nextId: string | null };
  facts: EmployeeFacts;
  profile: EmployeeProfile;
  tabs: EmployeeRecordTab[];
  active: EmployeeRecordTabData;
  /** A tab whose data could not be loaded (shown as an error, not a crash). */
  failed: boolean;
  permissions: { edit: boolean };
}


// ---------------------------------------------------------------------------
// Full-page form (4.2): /workforce/employees/new and /[id]/edit
// ---------------------------------------------------------------------------

export interface EmployeeFormContext {
  /** Present when editing. The form holds the full bank account: it needs EDIT permission. */
  employeeId: string | null;
  initial: EmployeeFormData;
  branches: { id: string; name: string }[];
  /** Active departments (plus the current one); branchIds empty = open to every branch (4.3). */
  departments: { id: string; name: string; branchIds: string[] }[];
  designations: { id: string; name: string; departmentId: string }[];
  categories: { value: string; label: string }[];
  shreniLevels: { code: string; name: string; labelNepali?: string; minSalary?: number }[];
  gradePolicy: GradePolicySettings | null;
  /** Salary mapping → Edit: may change basic salary, grades and type a grade by hand (checked again on save). */
  canEditPay: boolean;
  supervisors: { id: string; name: string; employeeCode: string }[];
  /** Every code in the company, for the next-code suggestion and duplicate hints. */
  codes: { id: string; employeeCode: string; attendanceCode: string }[];
  roles: { id: string; name: string; slug: string }[];
  access: { email: string; roleId: string | null; roleName: string | null; state: "active" | "pending" | "disabled" } | null;
}
