/**
 * Department (read model). Departments are company-wide functions (4.3),
 * optionally limited to some branches. Editing lives in Organization
 * (lib/types/organization.ts, lib/services/organization.service.ts).
 */
export type DepartmentStatus = "active" | "inactive";

export interface Department {
  id: string;
  code: string;
  name: string;
  /** Branches the department is open to; empty = all branches. */
  branchIds: string[];
  headEmployeeId: string | null;
  /** Older typed head name, shown until an employee is picked. */
  headName: string | null;
  /** Live counts (never the stored counters). */
  designationCount: number;
  employeeCount: number;
  description: string;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string;
}
