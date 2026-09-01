/**
 * Salary Mapping engine — pure domain logic for validating,
 * calculating, and filtering salary mappings.
 *
 * Framework-agnostic (no React, no Next.js, no DB imports).
 * Used by:
 *   1. The Salary Mapping UI (form validation, KPI card math)
 *   2. The Service layer (re-validates before persisting)
 *   3. Unit tests
 */

import type {
  SalaryMapping,
  SalaryMappingFormData,
  SalaryMappingFilter,
  SalaryMappingKPIs,
  SalaryHeadAssignment,
  SalaryHeadFormItem,
} from "@/lib/types/salary-mapping";
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SalaryMappingValidationErrors {
  employeeId?: string;
  fiscalYearId?: string;
  effectiveFrom?: string;
  basicSalary?: string;
  gradePercent?: string;
  gradeAmount?: string;
  salaryHeads?: string;
  loan1Deduction?: string;
  loan2Deduction?: string;
  duplicate?: string;
}

export interface ValidateSalaryMappingArgs {
  data: SalaryMappingFormData;
  /** Existing mappings to check uniqueness */
  existing: SalaryMapping[];
  /** Employee IDs that exist (valid FK) */
  validEmployeeIds: string[];
  /** Pay head IDs that are valid */
  validPayHeadIds: string[];
  /** When editing, exclude this mapping's own employee from uniqueness check */
  excludeMappingId?: string;
}

/**
 * Validate a salary mapping form payload.
 * Rules:
 *   1. Employee is required and must exist
 *   2. One active mapping per employee
 *   3. Basic salary > 0
 *   4. Grade percent 0–200
 *   5. Grade amount >= 0
 *   6. Effective from date required
 *   7. Pay head IDs must be valid
 *   8. Loan deductions >= 0
 */
export function validateSalaryMapping(
  args: ValidateSalaryMappingArgs,
): SalaryMappingValidationErrors {
  const { data, existing, validEmployeeIds, validPayHeadIds, excludeMappingId } = args;
  const errors: SalaryMappingValidationErrors = {};

  // 1. Employee
  if (!data.employeeId) {
    errors.employeeId = "Employee is required.";
  } else if (!validEmployeeIds.includes(data.employeeId)) {
    errors.employeeId = "Selected employee does not exist.";
  }

  // 2. Duplicate — one active mapping per employee
  if (data.employeeId) {
    const duplicate = existing.find(
      (m) =>
        m.employeeId === data.employeeId &&
        m.isActive &&
        m.id !== excludeMappingId,
    );
    if (duplicate) {
      errors.duplicate = "This employee already has an active salary mapping.";
    }
  }

  // 3. Basic salary
  if (!Number.isFinite(data.basicSalary) || data.basicSalary <= 0) {
    errors.basicSalary = "Basic salary must be greater than 0.";
  }

  // 4. Grade percent
  if (!Number.isFinite(data.gradePercent) || data.gradePercent < 0 || data.gradePercent > 200) {
    errors.gradePercent = "Grade % must be between 0 and 200.";
  }

  // 5. Grade amount
  if (!Number.isFinite(data.gradeAmount) || data.gradeAmount < 0) {
    errors.gradeAmount = "Grade amount must be 0 or greater.";
  }

  // 6. Effective from
  if (!data.effectiveFrom) {
    errors.effectiveFrom = "Effective from date is required.";
  }

  // 7. Pay head IDs must be valid
  if (data.salaryHeads && data.salaryHeads.length > 0) {
    const invalidHeads = data.salaryHeads.filter(
      (h) => !validPayHeadIds.includes(h.payHeadId),
    );
    if (invalidHeads.length > 0) {
      errors.salaryHeads = `One or more selected pay heads are invalid.`;
    }
  }

  // 8. Loan deductions
  if (!Number.isFinite(data.loan1Deduction) || data.loan1Deduction < 0) {
    errors.loan1Deduction = "Loan 1 deduction must be 0 or greater.";
  }
  if (!Number.isFinite(data.loan2Deduction) || data.loan2Deduction < 0) {
    errors.loan2Deduction = "Loan 2 deduction must be 0 or greater.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Net salary calculation
// ---------------------------------------------------------------------------

export interface CalculateNetSalaryArgs {
  basicSalary: number;
  gradePercent: number;
  gradeAmount: number;
  salaryHeads: (Pick<SalaryHeadAssignment, "payHeadType" | "amount">)[];
  loan1Deduction: number;
  loan2Deduction: number;
}

/**
 * Calculate net salary based on the formula:
 *   netAmount = basicSalary + (basicSalary * gradePercent/100) + gradeAmount
 *               + totalAllowances - totalDeductions - loan1 - loan2
 */
export function calculateNetSalary(args: CalculateNetSalaryArgs): number {
  const { basicSalary, gradePercent, gradeAmount, salaryHeads, loan1Deduction, loan2Deduction } = args;

  const dBasic = new Decimal(basicSalary);
  const dGradePercent = new Decimal(gradePercent);
  const dGradeAmount = new Decimal(gradeAmount);
  const dLoan1 = new Decimal(loan1Deduction);
  const dLoan2 = new Decimal(loan2Deduction);

  const gradeValue = dBasic.mul(dGradePercent.div(100));

  let totalAllowances = new Decimal(0);
  let totalDeductions = new Decimal(0);
  for (const head of salaryHeads) {
    if (head.payHeadType === "allowance") {
      totalAllowances = totalAllowances.plus(head.amount);
    } else {
      totalDeductions = totalDeductions.plus(head.amount);
    }
  }

  const net = dBasic
    .plus(gradeValue)
    .plus(dGradeAmount)
    .plus(totalAllowances)
    .minus(totalDeductions)
    .minus(dLoan1)
    .minus(dLoan2);

  const rounded = net.round().toNumber();
  return Math.max(0, rounded);
}

// ---------------------------------------------------------------------------
// KPI calculation
// ---------------------------------------------------------------------------

/**
 * Calculate KPIs from a list of salary mappings and total employee count.
 */
export function calculateSalaryMappingKPIs(
  mappings: SalaryMapping[],
  totalEmployeeCount: number,
): SalaryMappingKPIs {
  const totalMappings = mappings.length;
  const totalBasic = mappings.reduce((sum, m) => sum + m.basicSalary, 0);
  const totalPayroll = mappings.reduce((sum, m) => sum + m.netAmount, 0);

  return {
    totalMappings,
    averageBasic: totalMappings > 0 ? Math.round(totalBasic / totalMappings) : 0,
    totalPayroll,
    unmappedCount: totalEmployeeCount - totalMappings,
  };
}

// ---------------------------------------------------------------------------
// Filter + search
// ---------------------------------------------------------------------------

export interface FilterSalaryMappingsArgs {
  mappings: SalaryMapping[];
  /** Employees keyed by id for lookup */
  employees: Map<string, {
    firstName: string;
    lastName: string;
    employeeCode: string;
    departmentId: string;
    branchId: string;
  }>;
  filter: SalaryMappingFilter;
}

/**
 * Apply search and filter criteria to salary mappings.
 */
export function filterSalaryMappings(
  args: FilterSalaryMappingsArgs,
): SalaryMapping[] {
  const { mappings, employees, filter } = args;
  const q = filter.search.trim().toLowerCase();

  return mappings.filter((m) => {
    const emp = employees.get(m.employeeId);
    if (!emp) return false;

    // Search by employee name or code
    if (q) {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const code = emp.employeeCode.toLowerCase();
      if (!fullName.includes(q) && !code.includes(q)) return false;
    }

    // Department filter
    if (filter.departmentId !== "all" && emp.departmentId !== filter.departmentId) {
      return false;
    }

    // Branch filter
    if (filter.branchId !== "all" && emp.branchId !== filter.branchId) {
      return false;
    }

    return true;
  });
}