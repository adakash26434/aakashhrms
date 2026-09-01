
import * as repository from "@/lib/repositories/salary-mapping.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import {
  validateSalaryMapping,
  calculateNetSalary,
  calculateSalaryMappingKPIs,
  type SalaryMappingValidationErrors,
} from "@/lib/engines/salary-mapping.engine";
import type {
  SalaryMapping,
  SalaryMappingData,
  SalaryMappingFormData,
  SalaryMappingFilter,
  SalaryMappingKPIs,
  SalaryHeadAssignment,
  SalaryHeadFormItem,
} from "@/lib/types/salary-mapping";


// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SalaryMappingValidationError extends Error {
  constructor(public errors: SalaryMappingValidationErrors) {
    super("Salary mapping validation failed");
    this.name = "SalaryMappingValidationError";
  }
}

export class SalaryMappingNotFoundError extends Error {
  constructor(public id: string) {
    super(`Salary mapping ${id} not found`);
    this.name = "SalaryMappingNotFoundError";
  }
}

export class SalaryMappingDuplicateError extends Error {
  constructor() {
    super("This employee already has an active salary mapping");
    this.name = "SalaryMappingDuplicateError";
  }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Load the full dataset for the page's initial render.
 * Combines mappings, active employees, pay heads, departments, branches, and fiscal years
 * into the shape consumed by `salary-mapping-client.tsx`.
 */
export async function getSalaryMappingData(): Promise<SalaryMappingData> {
  const [
    mappings,
    employees,
    payHeads,
    departments,
    branches,
    designations,
    fiscalYears,
  ] = await Promise.all([
    repository.findActiveMappings(),
    employeeRepository.findAll({
      search: "",
      departmentId: "all",
      branchId: "all",
      category: "all",
      status: "all",
    }),
    payHeadRepository.findAllPayHeads(),
    departmentRepository.findAllDepartments(),
    branchRepository.findAllBranches(),
    designationRepository.findAllDesignations(),
    fiscalYearRepository.findAllFiscalYears(),
  ]);

  // Filter ONLY Active employees for payroll mapping accuracy
  const activeEmployees = employees.filter((e) => e.status === "Active");

  // Build lookup maps
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const desigNameById = new Map(designations.map((d) => [d.id, d.name]));

  const employeeLookups = activeEmployees.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    departmentId: e.departmentId,
    departmentName: deptNameById.get(e.departmentId) ?? "—",
    branchId: e.branchId,
    branchName: branchNameById.get(e.branchId) ?? "—",
    designationName: desigNameById.get(e.designationId) ?? "—",
    gradePercent: e.gradePercent,
    gradeAmount: e.gradeAmount,
  }));

  // Group pay heads by type
  const allowanceHeads = payHeads
    .filter((h) => h.type === "allowance")
    .map((h) => ({
      id: h.id,
      name: h.name,
      calcBasis: h.calcBasis,
      calcParameter: h.calcParameter,
    }));

  const deductionHeads = payHeads
    .filter((h) => h.type === "deduction")
    .map((h) => ({
      id: h.id,
      name: h.name,
      calcBasis: h.calcBasis,
      calcParameter: h.calcParameter,
    }));

  // Calculate KPIs against Active employee count
  const kpis = calculateSalaryMappingKPIs(mappings, activeEmployees.length);

  // Map real Active Fiscal Years from DB (fallback to placeholder only if DB is unseeded)
  const activeFyList = fiscalYears
    .filter((fy) => fy.status === "Active")
    .map((fy) => ({ id: fy.id, fyNumber: fy.label }));

  return {
    mappings,
    employees: employeeLookups,
    allowanceHeads,
    deductionHeads,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    fiscalYears: activeFyList.length > 0 ? activeFyList : [{ id: "fy-1", fyNumber: "2081/82" }],
    kpis,
  };
}

/**
 * Get lookup data for the form modal — active employees, pay heads, etc.
 */
export async function getLookupData() {
  const [employees, payHeads] = await Promise.all([
    employeeRepository.findAll({
      search: "",
      departmentId: "all",
      branchId: "all",
      category: "all",
      status: "all",
    }),
    payHeadRepository.findAllPayHeads(),
  ]);

  return {
    employees: employees
      .filter((e) => e.status === "Active")
      .map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        departmentId: e.departmentId,
        gradePercent: e.gradePercent,
        gradeAmount: e.gradeAmount,
      })),
    allowanceHeads: payHeads
      .filter((h) => h.type === "allowance")
      .map((h) => ({ id: h.id, name: h.name, calcBasis: h.calcBasis })),
    deductionHeads: payHeads
      .filter((h) => h.type === "deduction")
      .map((h) => ({ id: h.id, name: h.name, calcBasis: h.calcBasis })),
  };
}

// ---------------------------------------------------------------------------
// Input shaping
// ---------------------------------------------------------------------------

/**
 * Convert SalaryHeadFormItem[] (form) → SalaryHeadAssignment[] (entity).
 * Looks up pay head metadata from the repository to set the correct type and name.
 */
async function buildSalaryHeads(
  items: SalaryHeadFormItem[],
): Promise<SalaryHeadAssignment[]> {
  if (items.length === 0) return [];
  const payHeads = await payHeadRepository.findAllPayHeads();
  const headMap = new Map(payHeads.map((h) => [h.id, h]));

  return items.map((item, idx) => {
    const ph = headMap.get(item.payHeadId);
    return {
      id: `sh-temp-${idx}`, // Repository ignores this and lets DB generate real UUID
      payHeadId: item.payHeadId,
      payHeadName: ph?.name ?? "Unknown",
      payHeadType: (ph?.type ?? "allowance") as "allowance" | "deduction",
      amount: item.amount,
      isChangeable: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create a new salary mapping.
 */
export async function createMapping(data: SalaryMappingFormData): Promise<SalaryMapping> {
  data.fiscalYearId = await resolveFiscalYearId(data.fiscalYearId);
  const [existing, employees, payHeads] = await Promise.all([
    repository.findActiveMappings(),
    employeeRepository.findAll({
      search: "", departmentId: "all", branchId: "all", category: "all", status: "all",
    }),
    payHeadRepository.findAllPayHeads(),
  ]);

  const errors = validateSalaryMapping({
    data,
    existing,
    validEmployeeIds: employees.map((e) => e.id),
    validPayHeadIds: payHeads.map((p) => p.id),
  });

  if (Object.keys(errors).length > 0) {
    throw new SalaryMappingValidationError(errors);
  }

  const salaryHeads = await buildSalaryHeads(data.salaryHeads);
  const netAmount = calculateNetSalary({
    basicSalary: data.basicSalary,
    gradePercent: data.gradePercent,
    gradeAmount: data.gradeAmount,
    salaryHeads: salaryHeads.map((h) => ({
      payHeadType: h.payHeadType,
      amount: h.amount,
    })),
    loan1Deduction: data.loan1Deduction,
    loan2Deduction: data.loan2Deduction,
  });

  return repository.create({
    employeeId: data.employeeId,
    fiscalYearId: data.fiscalYearId,
    effectiveFrom: data.effectiveFrom,
    basicSalary: data.basicSalary,
    gradePercent: data.gradePercent,
    gradeAmount: data.gradeAmount,
    salaryHeads,
    loan1Deduction: data.loan1Deduction,
    loan2Deduction: data.loan2Deduction,
    netAmount,
  });
}

/**
 * Update an existing salary mapping.
 */
export async function updateMapping(
  id: string,
  data: SalaryMappingFormData,
): Promise<SalaryMapping> {
  data.fiscalYearId = await resolveFiscalYearId(data.fiscalYearId);
  const existing = await repository.findById(id);
  if (!existing) {
    throw new SalaryMappingNotFoundError(id);
  }

  const [allMappings, employees, payHeads] = await Promise.all([
    repository.findActiveMappings(),
    employeeRepository.findAll({
      search: "", departmentId: "all", branchId: "all", category: "all", status: "all",
    }),
    payHeadRepository.findAllPayHeads(),
  ]);

  const errors = validateSalaryMapping({
    data,
    existing: allMappings,
    excludeMappingId: id,
    validEmployeeIds: employees.map((e) => e.id),
    validPayHeadIds: payHeads.map((p) => p.id),
  });

  if (Object.keys(errors).length > 0) {
    throw new SalaryMappingValidationError(errors);
  }

  const salaryHeads = await buildSalaryHeads(data.salaryHeads);
  const netAmount = calculateNetSalary({
    basicSalary: data.basicSalary,
    gradePercent: data.gradePercent,
    gradeAmount: data.gradeAmount,
    salaryHeads: salaryHeads.map((h) => ({
      payHeadType: h.payHeadType,
      amount: h.amount,
    })),
    loan1Deduction: data.loan1Deduction,
    loan2Deduction: data.loan2Deduction,
  });

  const updated = await repository.update(id, {
    employeeId: data.employeeId,
    basicSalary: data.basicSalary,
    gradePercent: data.gradePercent,
    gradeAmount: data.gradeAmount,
    salaryHeads,
    loan1Deduction: data.loan1Deduction,
    loan2Deduction: data.loan2Deduction,
    netAmount,
  });

  if (!updated) {
    throw new SalaryMappingNotFoundError(id);
  }

  return updated;
}

/**
 * Delete a salary mapping.
 */
export async function deleteMapping(id: string): Promise<void> {
  const existing = await repository.findById(id);
  if (!existing) {
    throw new SalaryMappingNotFoundError(id);
  }
  await repository.remove(id);
}

/**
 * Get list of active employees who do NOT have an active salary mapping.
 */
export async function getUnmappedEmployees() {
  const [employees, mappings] = await Promise.all([
    employeeRepository.findAll({
      search: "", departmentId: "all", branchId: "all", category: "all", status: "all",
    }),
    repository.findActiveMappings(),
  ]);

  const activeEmployees = employees.filter((e) => e.status === "Active");
  const mappedIds = new Set(mappings.map((m) => m.employeeId));
  return activeEmployees.filter((e) => !mappedIds.has(e.id));
}

/**
 * Bulk create mappings for multiple employees atomically.
 * Eliminates client-side loops and direct service calls in client components.
 */
export async function bulkCreateMappings(
  employeeIds: string[],
  baseData: {
    basicSalary: number;
    gradePercent: number;
    gradeAmount: number;
    fiscalYearId?: string;
    effectiveFrom?: string;
  }
): Promise<{ successCount: number; errorCount: number }> {
  let successCount = 0;
  let errorCount = 0;
  const effectiveFrom = baseData.effectiveFrom || new Date().toISOString().split("T")[0];
  const fiscalYearId = await resolveFiscalYearId(baseData.fiscalYearId);

  const CHUNK_SIZE = 10;
  for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
    const chunk = employeeIds.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (empId) => {
        try {
          await createMapping({
            employeeId: empId,
            fiscalYearId,
            effectiveFrom,
            basicSalary: baseData.basicSalary,
            gradePercent: baseData.gradePercent,
            gradeAmount: baseData.gradeAmount,
            salaryHeads: [],
            loan1Deduction: 0,
            loan2Deduction: 0,
          });
          return true;
        } catch {
          return false;
        }
      })
    );

    for (const success of results) {
      if (success) successCount++;
      else errorCount++;
    }
  }

  return { successCount, errorCount };
}

async function resolveFiscalYearId(inputFyId?: string): Promise<string> {
  // If it's already a valid UUID (36 chars with hyphens), use it directly
  if (inputFyId && inputFyId !== "fy-1" && inputFyId.length === 36 && inputFyId.includes("-")) {
    return inputFyId;
  }
  // Otherwise, fetch the active Fiscal Year UUID from PostgreSQL
  const fys = await fiscalYearRepository.findAllFiscalYears();
  const active = fys.find((f) => f.status === "Active") || fys[0];
  if (!active) {
    throw new Error("No active Fiscal Year found in the database. Please create a Fiscal Year first.");
  }
  return active.id;
}