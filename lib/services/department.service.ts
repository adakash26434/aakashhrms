/**
 * Department service — business orchestration layer.
 *
 * Sits between the React client and the repository. Knows about:
 *   - The repository (data IO)
 *   - The engine (domain rules + validation)
 *   - Cross-module data (branches — for the picker)
 *
 * Does NOT know about:
 *   - React, Next.js, or DOM types
 *   - The HTTP layer (Server Actions / REST are the repository's
 *     concern, not ours)
 *
 * The service is the **only** layer the React client talks to.
 * By keeping all side-effects (read/write/validate) behind a
 * single service boundary, swapping the mock repository for a
 * real DB or adding Server Actions later requires zero changes
 * to the React tree.
 */

import * as repository from "@/lib/repositories/department.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import {
  sortByName,
  validateDepartment,
  type DepartmentValidationErrors,
} from "@/lib/engines/department.engine";
import type {
  Department,
  DepartmentData,
  DepartmentFormData,
} from "@/lib/types/department";
import type { DepartmentWriteInput } from "@/lib/data/mock-departments";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a write fails one of the department validation
 * rules. The `errors` object is suitable for direct display in
 * the form modal — each key matches a field id.
 */
export class DepartmentValidationError extends Error {
  constructor(public errors: DepartmentValidationErrors) {
    super("Department validation failed");
    this.name = "DepartmentValidationError";
  }
}

/**
 * Thrown when the caller asks to update or delete a department
 * that doesn't exist (race condition or stale id).
 */
export class DepartmentNotFoundError extends Error {
  constructor(public id: string) {
    super(`Department ${id} not found`);
    this.name = "DepartmentNotFoundError";
  }
}

/**
 * Thrown when a delete is rejected because the department is
 * still referenced (e.g. by active employees or a locked
 * payroll run). The repository's hard-delete will throw this
 * once the Employees / Payslips modules exist.
 */
export class DepartmentInUseError extends Error {
  constructor(public id: string) {
    super(`Department ${id} is in use and cannot be deleted`);
    this.name = "DepartmentInUseError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

import * as designationRepository from "@/lib/repositories/designation.repository";
import { getDb } from "@/lib/db";
import { departments as departmentsTable, designations as designationsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Ensures designations are linked to their proper departments (HR, Finance, IT, Admin)
 * and keeps counters synchronized.
 */
export async function syncOrgStructure(): Promise<void> {
  try {
    const db = getDb();
    const depts = await db.select().from(departmentsTable);
    const desigs = await db.select().from(designationsTable);

    const deptByCode = new Map(depts.map((d) => [d.code, d.id]));

    for (const desig of desigs) {
      const lower = desig.name.toLowerCase();
      let targetDeptId: string | undefined;

      if ((lower.includes("human resources") || lower.includes("hr")) && deptByCode.has("HR")) {
        targetDeptId = deptByCode.get("HR");
      } else if ((lower.includes("accountant") || lower.includes("finance")) && deptByCode.has("FIN")) {
        targetDeptId = deptByCode.get("FIN");
      } else if ((lower.includes("software") || lower.includes("engineer") || lower.includes("developer") || lower.includes("it")) && deptByCode.has("IT")) {
        targetDeptId = deptByCode.get("IT");
      } else if ((lower.includes("marketing") || lower.includes("sales")) && deptByCode.has("MKT")) {
        targetDeptId = deptByCode.get("MKT");
      }

      if (targetDeptId && targetDeptId !== desig.departmentId) {
        await db
          .update(designationsTable)
          .set({ departmentId: targetDeptId, updatedAt: new Date() })
          .where(eq(designationsTable.id, desig.id));
      }
    }
  } catch (err) {
    console.error("[syncOrgStructure] Error:", err);
  }
}

/**
 * Load the full dataset for the page's initial render. Combines
 * departments, designations, and branches for full SSR and instant KPI calculation.
 */
export async function getDepartmentData(): Promise<DepartmentData> {
  await syncOrgStructure();

  const [departments, designations, branches] = await Promise.all([
    repository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    branchRepository.findAllBranches(),
  ]);

  const sorted = sortByName(departments);
  return {
    departments: sorted,
    designations,
    branches,
  };
}

/**
 * Return the list of branch `{id, name}` pairs. The form's
 * "Branch" picker calls this.
 */
export async function getBranches(): Promise<Array<{ id: string; name: string }>> {
  const branches = await branchRepository.findAllBranches();
  return branches.map((b) => ({ id: b.id, name: b.name }));
}

// ---------------------------------------------------------------------------
// Input shaping
// ---------------------------------------------------------------------------

/**
 * Convert `DepartmentFormData` (the form's shape) into
 * `DepartmentWriteInput` (the repository's shape). Currently
 * they are identical, but the indirection lets us evolve them
 * independently.
 */
function toWriteInput(data: DepartmentFormData): DepartmentWriteInput {
  return {
    code: data.code,
    name: data.name,
    branchId: data.branchId,
    headName: data.headName,
    description: data.description,
    status: data.status,
  };
}

// ---------------------------------------------------------------------------
// Writes — each method validates first, then delegates
// ---------------------------------------------------------------------------

/**
 * Create a new department. Performs:
 *   1. Validation — engine checks per-field + cross-field rules
 *      (uniqueness, valid branch id)
 *   2. Persistence — delegates to the repository
 *
 * Returns the newly-created department. Throws
 * `DepartmentValidationError` on validation failure.
 */
export async function createDepartment(
  data: DepartmentFormData,
): Promise<Department> {
  const existing = await repository.findAllDepartments();
  const allBranches = await branchRepository.findAllBranches();
  const errors = validateDepartment({
    data,
    existing,
    validBranchIds: allBranches.map((b) => b.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new DepartmentValidationError(errors);
  }
  return repository.createDepartment(toWriteInput(data));
}

/**
 * Update an existing department. Performs:
 *   1. Existence check — throws `DepartmentNotFoundError` if missing
 *   2. Validation — same engine rules as create, with the
 *      department's own id excluded from the uniqueness check
 *   3. Persistence — delegates to the repository
 */
export async function updateDepartment(
  id: string,
  data: DepartmentFormData,
): Promise<Department> {
  const existingAll = await repository.findAllDepartments();
  const existing = existingAll.find((d) => d.id === id);
  if (!existing) {
    throw new DepartmentNotFoundError(id);
  }

  const allBranches = await branchRepository.findAllBranches();
  const errors = validateDepartment({
    data,
    existing: existingAll,
    excludeId: id,
    validBranchIds: allBranches.map((b) => b.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new DepartmentValidationError(errors);
  }
  return repository.updateDepartment(id, toWriteInput(data));
}

/**
 * Delete a department. Performs:
 *   1. Existence check — throws `DepartmentNotFoundError` if missing
 *   2. In-use check — throws `DepartmentInUseError` if the
 *      department still has designations or employees mapped
 *      to it (this is the design's "delete Engineering"
 *      dialog warning: "This will also remove all 4
 *      designations assigned to it. Employees mapped to this
 *      department will need reassignment."). Today we treat
 *      the presence of any designation or employee as a
 *      soft block; once the Employees module ships we'll
 *      swap this for an explicit guard.
 *   3. Persistence — delegates to the repository
 *
 * **Production note:** When the Employees / Payslips modules
 * ship, this should also reject deletion of any department
 * referenced by a LOCKED payroll run.
 */
export async function deleteDepartment(id: string): Promise<void> {
  const existing = await repository.findDepartmentById(id);
  if (!existing) {
    throw new DepartmentNotFoundError(id);
  }
  if (existing.designationCount > 0 || existing.employeeCount > 0) {
    throw new DepartmentInUseError(id);
  }
  return repository.deleteDepartment(id);
}
