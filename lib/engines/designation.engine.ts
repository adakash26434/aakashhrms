/**
 * Designation engine — pure domain logic for validating,
 * aggregating, and querying designations.
 *
 * Framework-agnostic by design — no React, Next.js, or DB imports.
 */

import type { Designation, DesignationFormData } from "@/lib/types/designation";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface DesignationValidationErrors {
  name?: string;
  departmentId?: string;
  description?: string;
  status?: string;
}

const NAME_MIN = 1;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;

function isValidName(n: string): boolean {
  return n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;
}

// ----- Uniqueness helpers ---------------------------------------------------

export function isNameUnique(args: {
  candidate: string;
  existing: Designation[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (d) =>
      d.id !== args.excludeId && d.name.trim().toLowerCase() === target,
  );
}

// ----- Main validator -------------------------------------------------------

export interface ValidateDesignationArgs {
  data: DesignationFormData;
  existing: Designation[];
  excludeId?: string;
  /** Valid department IDs (used to validate the chosen department). */
  validDepartmentIds: string[];
}

/**
 * Validate a designation form payload.
 *
 *   1. Name required, 1–60 chars, unique.
 *   2. Department ID must be one of the valid department IDs.
 *   3. Description optional, 0–500 chars.
 *   4. Status must be "active" or "inactive".
 */
export function validateDesignation(
  args: ValidateDesignationArgs,
): DesignationValidationErrors {
  const { data, existing, excludeId, validDepartmentIds } = args;
  const errors: DesignationValidationErrors = {};

  // 1. Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Designation Name is required.";
  } else if (!isValidName(data.name)) {
    errors.name = `Designation Name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  } else if (!isNameUnique({ candidate: data.name, existing, excludeId })) {
    errors.name = `A designation named "${data.name.trim()}" already exists.`;
  }

  // 2. Department ID
  if (!data.departmentId || !data.departmentId.trim()) {
    errors.departmentId = "Department is required.";
  } else if (!validDepartmentIds.includes(data.departmentId)) {
    errors.departmentId = "Selected department is no longer available.";
  }

  // 3. Description (optional)
  if (data.description && data.description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or less.`;
  }

  // 4. Status
  if (data.status !== "active" && data.status !== "inactive") {
    errors.status = "Status is required.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Aggregations (used by KPI cards)
// ---------------------------------------------------------------------------

export interface DesignationCounts {
  total: number;
  active: number;
  inactive: number;
  totalEmployees: number;
}

export function countDesignations(
  designations: Designation[],
): DesignationCounts {
  let active = 0;
  let inactive = 0;
  let totalEmployees = 0;
  for (const d of designations) {
    if (d.status === "active") active++;
    else inactive++;
    totalEmployees += d.employeeCount;
  }
  return {
    total: designations.length,
    active,
    inactive,
    totalEmployees,
  };
}

// ---------------------------------------------------------------------------
// Filter + search helpers
// ---------------------------------------------------------------------------

export interface FilterDesignationsArgs {
  designations: Designation[];
  search?: string;
  /** Optional department filter. Empty string = all departments. */
  departmentId?: string;
  /** Optional status filter. Undefined = all statuses. */
  status?: "active" | "inactive";
}

export function filterDesignations(
  args: FilterDesignationsArgs,
): Designation[] {
  const { designations, search, departmentId, status } = args;
  const q = (search ?? "").trim().toLowerCase();

  return designations.filter((d) => {
    if (departmentId && d.departmentId !== departmentId) return false;
    if (status && d.status !== status) return false;
    if (!q) return true;
    const hay = [d.name].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function sortByDepartmentAndName(
  designations: Designation[],
): Designation[] {
  return [...designations].sort((a, b) => {
    const dept = a.departmentId.localeCompare(b.departmentId);
    if (dept !== 0) return dept;
    return a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase());
  });
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function nextDesignationId(existing: Designation[]): string {
  // Format: "desig-NNN" where NNN is a zero-padded number
  let max = 0;
  for (const d of existing) {
    const m = /^desig-(\d+)$/i.exec(d.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `desig-${String(max + 1).padStart(3, "0")}`;
}