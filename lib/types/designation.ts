/**
 * Designation (read model): a job title within a department. Editing lives
 * in Organization (lib/types/organization.ts).
 */
export type DesignationStatus = "active" | "inactive";

export interface Designation {
  id: string;
  name: string;
  departmentId: string;
  description: string;
  /** Live count of employees (any status). */
  employeeCount: number;
  status: DesignationStatus;
  createdAt: string;
  updatedAt: string;
}
