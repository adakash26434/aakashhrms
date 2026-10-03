// Organization (4.3): the workforce masters in one module — branches,
// company-wide departments, designations, grade levels (Shreni) and
// employment types — plus the structure matrix and the reporting chart.

export const ORG_TABS = ["structure", "reporting", "branches", "departments", "designations", "levels", "types"] as const;
export type OrgTab = (typeof ORG_TABS)[number];

/** The five masters edited on this page. */
export type OrgKind = "branch" | "department" | "designation" | "level" | "type";

export type OrgStatus = "active" | "inactive";

/** What still refers to a record. Anything above 0 blocks a delete (4.3: deletes only for unused records). */
export interface OrgUsage {
  /** Employees of any status (history must stay linked). */
  employees: number;
  /** Designations under a department. */
  designations?: number;
  /** Departments limited to a branch. */
  departments?: number;
  /** User logins whose access scope names it. */
  users?: number;
  /** Holidays limited to a branch. */
  holidays?: number;
  /** Payroll runs that were filtered by it. */
  payrollRuns?: number;
}

export interface OrgBranch {
  id: string;
  code: string;
  name: string;
  /** Structured address (serializeStructuredAddress) or older free text. */
  location: string;
  phone: string;
  email: string;
  isHeadOffice: boolean;
  remoteCategory: string;
  status: OrgStatus;
  /** Active employees. */
  headcount: number;
  usage: OrgUsage;
}

export interface OrgDepartment {
  id: string;
  code: string;
  name: string;
  /** Branches the department is open to; empty = all branches. */
  branchIds: string[];
  headEmployeeId: string | null;
  /** Older typed head name, shown until an employee is picked. */
  headName: string | null;
  description: string;
  status: OrgStatus;
  headcount: number;
  usage: OrgUsage;
}

export interface OrgDesignation {
  id: string;
  name: string;
  departmentId: string;
  description: string;
  status: OrgStatus;
  headcount: number;
  usage: OrgUsage;
}

export interface OrgLevel {
  id: string;
  code: string;
  name: string;
  levelNumber: number;
  labelNepali: string;
  description: string;
  minSalary: number;
  maxSalary: number;
  rankOrder: number;
  status: OrgStatus;
  headcount: number;
  usage: OrgUsage;
}

export interface OrgEmploymentType {
  id: string;
  code: string;
  name: string;
  nameNepali: string;
  isPfEligible: boolean;
  isSsfEligible: boolean;
  isFestivalEligible: boolean;
  isLeaveEligible: boolean;
  isOtEligible: boolean;
  noticePeriodDays: number;
  probationMonths: number;
  rankOrder: number;
  status: OrgStatus;
  headcount: number;
  usage: OrgUsage;
}

/** Active headcount for one branch × department × designation combination (no names). */
export interface OrgHeadcount {
  branchId: string;
  departmentId: string;
  designationId: string;
  count: number;
}

/** A person on the reporting chart and in pickers (needs Employees → View, within scope). */
export interface OrgPerson {
  id: string;
  fullName: string;
  employeeCode: string;
  status: "Active" | "Inactive";
  branchId: string;
  departmentId: string;
  designationId: string;
  supervisorId: string | null;
  isSupervisor: boolean;
}

export interface OrganizationData {
  tab: OrgTab;
  branches: OrgBranch[];
  departments: OrgDepartment[];
  designations: OrgDesignation[];
  levels: OrgLevel[];
  types: OrgEmploymentType[];
  headcounts: OrgHeadcount[];
  /** Null when the user may not see employees (no Employees → View). */
  people: OrgPerson[] | null;
  /** Industry presets for grade levels ("Load preset"). */
  levelPresets: { key: string; label: string }[];
  permissions: {
    add: boolean;
    edit: boolean;
    delete: boolean;
    /** Company-wide scope: branch- or department-scoped roles may only view masters (S19). */
    companyWide: boolean;
  };
}

// ---------------------------------------------------------------------------
// Form data (what the Window editors send)
// ---------------------------------------------------------------------------

export interface BranchInput {
  code: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  isHeadOffice: boolean;
  remoteCategory: string;
}

export interface DepartmentInput {
  code: string;
  name: string;
  branchIds: string[];
  headEmployeeId: string | null;
  description: string;
}

export interface DesignationInput {
  name: string;
  departmentId: string;
  description: string;
}

export interface LevelInput {
  code: string;
  name: string;
  levelNumber: number;
  labelNepali: string;
  description: string;
  minSalary: number;
  maxSalary: number;
  rankOrder: number;
}

export interface EmploymentTypeInput {
  code: string;
  name: string;
  nameNepali: string;
  isPfEligible: boolean;
  isSsfEligible: boolean;
  isFestivalEligible: boolean;
  isLeaveEligible: boolean;
  isOtEligible: boolean;
  noticePeriodDays: number;
  probationMonths: number;
  rankOrder: number;
}

export type OrgInput = BranchInput | DepartmentInput | DesignationInput | LevelInput | EmploymentTypeInput;

export type OrgErrors = Record<string, string>;
