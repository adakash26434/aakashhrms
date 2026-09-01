import type { EmployeeCategory } from "./system-control";

export type EmployeeStatus = "Active" | "On Leave" | "Terminated";
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
  firstName: string;
  lastName: string;
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
  joiningDate: Date;
  confirmationDate: Date | null;
  retirementDateProjected: Date | null;
  status: EmployeeStatus;
  salaryGrade: string;
  gradePercent: number;
  gradeAmount: number;

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
  firstName: string;
  lastName: string;
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
  joiningDate: string;
  confirmationDate: string;
  retirementDateProjected: string;
  status: EmployeeStatus;
  salaryGrade: string;
  gradePercent: number;
  gradeAmount: number;

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

export interface EmployeeKPIs {
  total: number;
  active: number;
  onLeave: number;
  terminated: number;
  departmentsCount: number;
}

export interface EmployeeValidationErrors {
  attendanceCode?: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
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
  joiningDate?: string;
  confirmationDate?: string;
  retirementDateProjected?: string;
  status?: string;
  salaryGrade?: string;
  gradePercent?: string;
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
