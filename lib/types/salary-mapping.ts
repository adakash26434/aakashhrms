/**
 * Salary Mapping — domain types.
 *
 * A Salary Mapping defines an employee's salary structure for a given
 * fiscal year. It ties together:
 *   - Basic salary + grade % + grade amount (the "base")
 *   - A dynamic list of pay heads (allowances & deductions) with amounts
 *   - Loan deduction placeholders (for future Loan module)
 *
 * The Excel sheet "Employee wise Salary Mapping(M)" defines the columns:
 *   Employee Name | Basic Salary | Grade % | Grade Amount |
 *   Allowance Name1..3 | Deduction1..3 | Loan 1 Deduction |
 *   Loan 2 Deduction | Net amount
 *
 * Per the architecture doc §4.2, this is split into:
 *   - `employee_salary_map` (the base record)
 *   - `employee_salary_heads` (each pay head assignment)
 */

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

/**
 * A single pay head assignment within a salary mapping.
 * Each entry links a pay head with a fixed amount (NPR).
 */
export interface SalaryHeadAssignment {
  id: string;
  payHeadId: string;
  payHeadName: string;
  payHeadType: "allowance" | "deduction";
  amount: number;
  isChangeable: boolean;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type SalaryMappingStatus = "active" | "inactive";

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface SalaryMapping {
  id: string;
  /** FK → Employee */
  employeeId: string;
  /** FK → FiscalYear (future module) */
  fiscalYearId: string;
  /** Date this mapping takes effect (ISO string) */
  effectiveFrom: string;

  // -- Base salary components --
  basicSalary: number;
  /** Grade % — e.g. 100 means 100% of basic (full grade), 50 means 50%  */
  gradePercent: number;
  /** Grade amount in NPR — pre-populated from Employee, editable here */
  gradeAmount: number;

  // -- Dynamic pay head assignments --
  salaryHeads: SalaryHeadAssignment[];

  // -- Loan deductions (placeholder for future Loan module) --
  loan1Deduction: number;
  loan2Deduction: number;
  /** Display-only: remaining balance for Loan 1 (from Loan module) */
  loan1Remaining: number;
  /** Display-only: remaining balance for Loan 2 (from Loan module) */
  loan2Remaining: number;

  // -- Computed --
  netAmount: number;

  // -- Metadata --
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

export interface SalaryMappingFormData {
  employeeId: string;
  fiscalYearId: string;
  effectiveFrom: string;
  basicSalary: number;
  gradePercent: number;
  gradeAmount: number;
  salaryHeads: SalaryHeadFormItem[];
  loan1Deduction: number;
  loan2Deduction: number;
}

export interface SalaryHeadFormItem {
  payHeadId: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export interface SalaryMappingFilter {
  search: string;
  departmentId: string | "all";
  branchId: string | "all";
  /** Show only unmapped employees when true */
  unmappedOnly: boolean;
  /** Filter by fiscal year id (defaults to current FY) */
  fiscalYearId: string;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface SalaryMappingKPIs {
  totalMappings: number;
  averageBasic: number;
  totalPayroll: number;
  unmappedCount: number;
}

// ---------------------------------------------------------------------------
// Aggregate shape returned by the data layer
// ---------------------------------------------------------------------------

export interface SalaryMappingData {
  mappings: SalaryMapping[];
  /** All employees (for the employee selector) */
  employees: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    departmentId: string;
    departmentName: string;
    branchId: string;
    branchName: string;
    designationName: string;
    gradePercent: number;
    gradeAmount: number;
  }[];
  /** Pay heads grouped by type for the form */
  allowanceHeads: { id: string; name: string; calcBasis: string; calcParameter: string }[];
  deductionHeads: { id: string; name: string; calcBasis: string; calcParameter: string }[];
  /** Lookup data for filters and form */
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  /** Available fiscal years */
  fiscalYears: { id: string; fyNumber: string }[];
  /** KPIs computed from mappings */
  kpis: SalaryMappingKPIs;
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

/**
 * Format a NPR amount with en-IN (Indian) locale.
 * e.g. 100000 → "1,00,000"
 */
export function formatNPR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `NPR ${value.toLocaleString("en-IN")}`;
}

/**
 * Format grade percent with % suffix.
 */
export function formatGradePercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value}%`;
}