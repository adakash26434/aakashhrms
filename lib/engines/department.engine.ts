/**
 * Department engine — pure domain logic for validating,
 * aggregating, and querying departments.
 *
 * This module is **framework-agnostic** by design:
 *   - No React imports
 *   - No Next.js imports
 *   - No Drizzle / database imports
 *
 * Everything here is a pure function of its inputs. The same
 * engine is used by:
 *   1. The Department Setup UI (form validation, KPI card math,
 *      search / sort)
 *   2. The Service layer (re-validates before persisting)
 *   3. Unit tests (Vitest, no DOM)
 *
 * **Cross-field rules:**
 *   - Code uniqueness (case-insensitive, trim-aware).
 *   - Name uniqueness (case-insensitive, trim-aware).
 *   - Branch ID (when non-empty) must be a subset of the
 *     available branches (passed in by the caller).
 *   - Head name is required (per the design's edit modal
 *     marking it as a required field).
 *
 * The denormalized counters (`designationCount`, `employeeCount`)
 * are managed by the service layer — the form doesn't edit them
 * today and the engine never validates them.
 */

import type { Department, DepartmentFormData } from "@/lib/types/department";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface DepartmentValidationErrors {
  code?: string;
  name?: string;
  branchId?: string;
  headName?: string;
  description?: string;
  status?: string;
}

const CODE_MIN = 2;
const CODE_MAX = 10;
const NAME_MIN = 1;
const NAME_MAX = 60;
const HEAD_NAME_MIN = 2;
const HEAD_NAME_MAX = 80;
const DESCRIPTION_MAX = 500;

function isValidCode(c: string): boolean {
  // Alphanumeric + hyphen, e.g. "ENG", "HR-ADM". Disallow
  // spaces and punctuation so codes stay safe in URLs and
  // identifiers.
  if (c.length < CODE_MIN || c.length > CODE_MAX) return false;
  return /^[A-Za-z0-9-]+$/.test(c);
}

function isValidName(n: string): boolean {
  return n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;
}

function isValidHeadName(n: string): boolean {
  const t = n.trim();
  return t.length >= HEAD_NAME_MIN && t.length <= HEAD_NAME_MAX;
}

// ----- Uniqueness helpers (public) -----------------------------------------

/**
 * Case-insensitive code uniqueness. Used at create and update
 * time. Pass `excludeId` when updating so the department's
 * own current code doesn't collide with itself.
 */
export function isCodeUnique(args: {
  candidate: string;
  existing: Department[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (d) =>
      d.id !== args.excludeId && d.code.trim().toLowerCase() === target,
  );
}

/**
 * Case-insensitive name uniqueness. Same shape as
 * `isCodeUnique`.
 */
export function isNameUnique(args: {
  candidate: string;
  existing: Department[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (d) =>
      d.id !== args.excludeId && d.name.trim().toLowerCase() === target,
  );
}

// ----- Main validator ------------------------------------------------------

export interface ValidateDepartmentArgs {
  data: DepartmentFormData;
  existing: Department[];
  excludeId?: string;
  /** Valid branch IDs (used to validate the chosen branch). */
  validBranchIds: string[];
}

/**
 * Validate a department form payload. Combines per-field rules
 * with cross-field rules:
 *
 *   1. Code required, 2–10 chars, alphanumeric+hyphen, unique.
 *   2. Name required, 1–60 chars, unique.
 *   3. Branch ID must be one of the valid branch IDs.
 *   4. Head name required, 2–80 chars.
 *   5. Description optional, 0–500 chars.
 *   6. Status must be "active" or "inactive".
 */
export function validateDepartment(
  args: ValidateDepartmentArgs,
): DepartmentValidationErrors {
  const { data, existing, excludeId, validBranchIds } = args;
  const errors: DepartmentValidationErrors = {};

  // 1. Code
  if (!data.code || !data.code.trim()) {
    errors.code = "Department Code is required.";
  } else if (!isValidCode(data.code.trim())) {
    errors.code = `Department Code must be ${CODE_MIN}–${CODE_MAX} characters and use letters, digits, or hyphens only.`;
  } else if (
    !isCodeUnique({ candidate: data.code, existing, excludeId })
  ) {
    errors.code = `A department with code "${data.code.trim()}" already exists.`;
  }

  // 2. Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Department Name is required.";
  } else if (!isValidName(data.name)) {
    errors.name = `Department Name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  } else if (
    !isNameUnique({ candidate: data.name, existing, excludeId })
  ) {
    errors.name = `A department named "${data.name.trim()}" already exists.`;
  }

  // 3. Branch ID
  if (!data.branchId || !data.branchId.trim()) {
    errors.branchId = "Branch is required.";
  } else if (!validBranchIds.includes(data.branchId)) {
    errors.branchId = "Selected branch is no longer available.";
  }

  // 4. Head name
  if (!data.headName || !data.headName.trim()) {
    errors.headName = "Head of Department is required.";
  } else if (!isValidHeadName(data.headName)) {
    errors.headName = `Head of Department must be ${HEAD_NAME_MIN}–${HEAD_NAME_MAX} characters.`;
  }

  // 5. Description (optional)
  if (data.description && data.description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or less.`;
  }

  // 6. Status
  if (data.status !== "active" && data.status !== "inactive") {
    errors.status = "Status is required.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Aggregations (used by KPI cards)
// ---------------------------------------------------------------------------

export interface DepartmentCounts {
  /** Total number of departments defined. */
  total: number;
  /** Departments whose `status === "active"`. */
  active: number;
  /** Departments whose `status === "inactive"`. */
  inactive: number;
  /** Sum of `designationCount` across every department. */
  totalDesignations: number;
  /** Sum of `employeeCount` across every department. */
  totalEmployees: number;
}

export function countDepartments(departments: Department[]): DepartmentCounts {
  let active = 0;
  let inactive = 0;
  let totalDesignations = 0;
  let totalEmployees = 0;
  for (const d of departments) {
    if (d.status === "active") active++;
    else inactive++;
    totalDesignations += d.designationCount;
    totalEmployees += d.employeeCount;
  }
  return {
    total: departments.length,
    active,
    inactive,
    totalDesignations,
    totalEmployees,
  };
}

// ---------------------------------------------------------------------------
// Filter + search helpers
// ---------------------------------------------------------------------------

export interface FilterDepartmentsArgs {
  departments: Department[];
  /**
   * Free-text query. Matches the department code, name, head
   * name, or the branch's display name (case-insensitive).
   * Empty string returns every department.
   */
  search?: string;
  /** Optional branch filter. Empty string = all branches. */
  branchId?: string;
  /** Optional status filter. Undefined = all statuses. */
  status?: "active" | "inactive";
}

/**
 * Apply the search + branch + status filters to a department
 * list. Order is preserved (the caller is expected to pass a
 * pre-sorted list).
 */
export function filterDepartments(
  args: FilterDepartmentsArgs,
): Department[] {
  const { departments, search, branchId, status } = args;
  const q = (search ?? "").trim().toLowerCase();

  return departments.filter((d) => {
    // Branch filter
    if (branchId && d.branchId !== branchId) return false;

    // Status filter
    if (status && d.status !== status) return false;

    // Free-text search
    if (!q) return true;
    const hay = [d.code, d.name, d.headName].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort departments by name (ascending, case-insensitive). Ties
 * are broken by code for stability. This is the order shown
 * in the design screenshots (Engineering first, Operations
 * second, …).
 */
export function sortByName(departments: Department[]): Department[] {
  return [...departments].sort((a, b) => {
    const an = a.name.trim().toLowerCase();
    const bn = b.name.trim().toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return a.code.localeCompare(b.code);
  });
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Generate the next sequential department id, e.g. "dept-001",
 * "dept-002", …, "dept-007", "dept-008".
 *
 * Inspects the existing list and returns the max numeric suffix
 * + 1, zero-padded to 3 digits. Falls back to "dept-001" if no
 * existing departments.
 */
export function nextDepartmentCode(existing: Department[]): string {
  let max = 0;
  for (const d of existing) {
    const m = /^dept-(\d+)$/i.exec(d.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `dept-${String(max + 1).padStart(3, "0")}`;
}
