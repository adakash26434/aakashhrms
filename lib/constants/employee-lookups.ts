import type { Employee } from "@/lib/types/employee";

export interface EmployeeLookups {
  departmentNameById: Map<string, string>;
  branchNameById: Map<string, string>;
  designationNameById: Map<string, string>;
  employeeNameById: Map<string, string>;
}

export interface RawLookupData {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string; departmentId: string }[];
  employees: { id: string; name: string; employeeCode?: string; attendanceCode?: string }[];
}

export function buildEmployeeLookups(
  employees: Employee[],
  lookupData?: RawLookupData,
): EmployeeLookups {
  const departmentNameById = new Map<string, string>();
  for (const d of (lookupData?.departments ?? [])) departmentNameById.set(d.id, d.name);

  const branchNameById = new Map<string, string>();
  for (const b of (lookupData?.branches ?? [])) branchNameById.set(b.id, b.name);

  const designationNameById = new Map<string, string>();
  for (const d of (lookupData?.designations ?? [])) designationNameById.set(d.id, d.name);

  const employeeNameById = new Map<string, string>();
  for (const e of (lookupData?.employees ?? [])) {
    employeeNameById.set(e.id, e.name);
  }
  for (const e of employees) {
    employeeNameById.set(e.id, `${e.firstName} ${e.lastName}`);
  }

  return {
    departmentNameById,
    branchNameById,
    designationNameById,
    employeeNameById,
  };
}

export function resolveDepartmentName(
  id: string,
  map: Map<string, string>,
): string {
  return map.get(id) ?? id;
}

export function resolveBranchName(id: string, map: Map<string, string>): string {
  return map.get(id) ?? id;
}

export function resolveDesignationName(
  id: string,
  map: Map<string, string>,
): string {
  return map.get(id) ?? id;
}

export function resolveEmployeeName(
  id: string | null | undefined,
  map: Map<string, string>,
): string {
  if (!id) return "—";
  return map.get(id) ?? id;
}
