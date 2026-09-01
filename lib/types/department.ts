/**
 * Department Setup — domain types.
 *
 * A Department is the second tier in the org hierarchy (after
 * branches). It groups positions (designations) and the
 * employees that hold them. Every department belongs to
 * exactly one branch and has a single head-of-department
 * (free-text for now, until the Employees module lands a
 * proper employee picker).
 *
 * The shape mirrors the `departments` table the architecture
 * document describes, plus UI-only fields (`createdAt`,
 * `updatedAt`) for the future audit log. Counters
 * (`designationCount`, `employeeCount`) are persisted today
 * so the KPI cards can render instantly without cross-table
 * joins; tomorrow they'll be SQL aggregates.
 *
 * **Counts are denormalized for now.** When the Designation
 * and Employee modules ship, these will become computed
 * columns (or SQL views). The form lets the user edit them
 * directly until that wiring is in place — the design's
 * "delete Engineering" dialog shows them prominently so the
 * user must always know what they're about to remove.
 */

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Cog,
  Coins,
  Headphones,
  Megaphone,
  Truck,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * The two-state lifecycle of a department. Inactive departments
 * are kept around (employees still reference them) but are
 * excluded from the active pickers in downstream modules.
 */
export const DEPARTMENT_STATUSES = ["active", "inactive"] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export interface DepartmentStatusMeta {
  /** Human label, e.g. "Active". */
  label: string;
  /** Description used in tooltips / helper text. */
  description: string;
  /** Tonal accent for the status pill. */
  tone: "emerald" | "gray";
}

export const DEPARTMENT_STATUS_META: Record<
  DepartmentStatus,
  DepartmentStatusMeta
> = {
  active: {
    label: "Active",
    description: "Available for new hires and payroll runs.",
    tone: "emerald",
  },
  inactive: {
    label: "Inactive",
    description: "Hidden from pickers. Existing employees keep their mapping.",
    tone: "gray",
  },
};

/**
 * A small per-department icon hint, used to give the table's
 * "Department" column a visual mark and the empty-state a
 * touch of color. We key off the code prefix (the codes in
 * the seed fixture — ENG, OPS, FIN, HR-ADM, SALES, CSUPP,
 * LOG — map to a handful of well-known business functions).
 */
export const DEPARTMENT_ICON_MAP: Record<string, LucideIcon> = {
  ENG: Cog,
  OPS: Briefcase,
  FIN: Coins,
  "HR-ADM": Users,
  HR: Users,
  SALES: Megaphone,
  CSUPP: Headphones,
  SUP: Headphones,
  LOG: Truck,
  MKT: Megaphone,
  IT: Cog,
  DEFAULT: Briefcase,
};

export function departmentIcon(code: string): LucideIcon {
  return DEPARTMENT_ICON_MAP[code.toUpperCase()] ?? DEPARTMENT_ICON_MAP.DEFAULT;
}

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface Department {
  id: string;
  /** Short code, e.g. "ENG", "OPS", "HR-ADM". */
  code: string;
  /** Human-friendly name, e.g. "Engineering". */
  name: string;
  /** FK to the branch the department belongs to. */
  branchId: string;
  /**
   * Free-text name of the head of the department. Stays a
   * string until the Employees module ships a proper picker.
   */
  headName: string;
  /**
   * Number of designations (positions) under this department.
   * Persisted today for fast KPI rendering; will become a
   * derived count in production.
   */
  designationCount: number;
  /**
   * Number of employees assigned to this department. Persisted
   * today for the same reason as `designationCount`.
   */
  employeeCount: number;
  /** Optional free-text description of the department's remit. */
  description: string;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

/**
 * The shape the form modal binds to. It mirrors `Department`
 * minus the auto-generated `id`, `createdAt`, and `updatedAt`
 * and minus the denormalized counts (those are managed by the
 * service layer once the Designation/Employee modules exist).
 */
export interface DepartmentFormData {
  code: string;
  name: string;
  branchId: string;
  headName: string;
  description: string;
  status: DepartmentStatus;
}

// ---------------------------------------------------------------------------
// Aggregate shape returned by the data layer
// ---------------------------------------------------------------------------

import type { Designation } from "./designation";
import type { Branch } from "./branch";

/**
 * The bag of data the page needs for its initial render. Includes
 * departments, designations, and branches for full SSR and instant KPI calculation.
 */
export interface DepartmentData {
  departments: Department[];
  designations: Designation[];
  branches: Branch[];
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

export function formatStatus(s: DepartmentStatus): string {
  return DEPARTMENT_STATUS_META[s].label;
}

export function formatStatusDescription(s: DepartmentStatus): string {
  return DEPARTMENT_STATUS_META[s].description;
}

/**
 * Pretty-print a count. "0 staff", "1 staff", "4 staff". The
 * design's table uses this wording verbatim.
 */
export function formatStaffCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return `${n} staff`;
}

/**
 * Pretty-print a positions count. "0 positions", "1 positions",
 * "4 positions" (per the design's "X positions" wording — we
 * always use the plural form for grammatical consistency).
 */
export function formatPositionsCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return `${n} positions`;
}

