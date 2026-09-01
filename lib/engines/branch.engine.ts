/**
 * Branch engine — pure domain logic for validating,
 * aggregating, and querying branches.
 *
 * Framework-agnostic by design — no React, Next.js, or DB imports.
 */

import type { Branch, BranchFormData } from "@/lib/types/branch";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface BranchValidationErrors {
  code?: string;
  name?: string;
  location?: string;
  phone?: string;
  email?: string;
  status?: string;
}

const CODE_MIN = 2;
const CODE_MAX = 10;
const NAME_MIN = 1;
const NAME_MAX = 80;
const LOCATION_MAX = 200;
const PHONE_MAX = 30;
const EMAIL_MAX = 100;

function isValidCode(c: string): boolean {
  if (c.length < CODE_MIN || c.length > CODE_MAX) return false;
  return /^[A-Za-z0-9-]+$/.test(c);
}

function isValidName(n: string): boolean {
  return n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;
}

export function isCodeUnique(args: {
  candidate: string;
  existing: Branch[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (b) =>
      b.id !== args.excludeId && b.code.trim().toLowerCase() === target,
  );
}

export function isNameUnique(args: {
  candidate: string;
  existing: Branch[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (b) =>
      b.id !== args.excludeId && b.name.trim().toLowerCase() === target,
  );
}

export function validateBranch(
  args: {
    data: BranchFormData;
    existing: Branch[];
    excludeId?: string;
  },
): BranchValidationErrors {
  const { data, existing, excludeId } = args;
  const errors: BranchValidationErrors = {};

  // 1. Code
  if (!data.code || !data.code.trim()) {
    errors.code = "Branch Code is required.";
  } else if (!isValidCode(data.code.trim())) {
    errors.code = `Branch Code must be ${CODE_MIN}–${CODE_MAX} characters and use letters, digits, or hyphens only.`;
  } else if (!isCodeUnique({ candidate: data.code, existing, excludeId })) {
    errors.code = `A branch with code "${data.code.trim()}" already exists.`;
  }

  // 2. Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Branch Name is required.";
  } else if (!isValidName(data.name)) {
    errors.name = `Branch Name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  } else if (!isNameUnique({ candidate: data.name, existing, excludeId })) {
    errors.name = `A branch named "${data.name.trim()}" already exists.`;
  }

  // 3. Location
  if (!data.location.trim()) {
    errors.location = "Location is required.";
  } else if (data.location.length > LOCATION_MAX) {
    errors.location = `Location must be ${LOCATION_MAX} characters or less.`;
  }

  // 4. Phone (optional)
  if (data.phone && data.phone.length > PHONE_MAX) {
    errors.phone = `Phone must be ${PHONE_MAX} characters or less.`;
  }

  // 5. Email (optional)
  if (data.email && data.email.length > EMAIL_MAX) {
    errors.email = `Email must be ${EMAIL_MAX} characters or less.`;
  }

  // 6. Status
  if (data.status !== "active" && data.status !== "inactive") {
    errors.status = "Status is required.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

export interface BranchCounts {
  total: number;
  active: number;
  inactive: number;
}

export function countBranches(branches: Branch[]): BranchCounts {
  let active = 0;
  let inactive = 0;
  for (const b of branches) {
    if (b.status === "active") active++;
    else inactive++;
  }
  return { total: branches.length, active, inactive };
}

// ---------------------------------------------------------------------------
// Filter + search
// ---------------------------------------------------------------------------

export interface FilterBranchesArgs {
  branches: Branch[];
  search?: string;
  status?: "active" | "inactive";
}

export function filterBranches(args: FilterBranchesArgs): Branch[] {
  const { branches, search, status } = args;
  const q = (search ?? "").trim().toLowerCase();

  return branches.filter((b) => {
    if (status && b.status !== status) return false;
    if (!q) return true;
    const hay = [b.code, b.name, b.location, b.phone, b.email]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function sortBranchesByName(branches: Branch[]): Branch[] {
  return [...branches].sort((a, b) => {
    return a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase());
  });
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function nextBranchId(existing: Branch[]): string {
  let max = 0;
  for (const b of existing) {
    const m = /^branch-(\d+)$/i.exec(b.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `branch-${String(max + 1).padStart(3, "0")}`;
}