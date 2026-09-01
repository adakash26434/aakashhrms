/**
 * Designation Setup — domain types.
 *
 * A Designation (position) belongs to exactly one department
 * and represents a job role within the organisation hierarchy.
 * Designations are the primary axis for pay-head applicability
 * (a pay head applies to one or more designations) and for
 * employee assignments.
 *
 * Future: When the Employees module ships, `employeeCount`
 * will become a derived count (SQL aggregate) rather than a
 * persisted field.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const DESIGNATION_STATUSES = ["active", "inactive"] as const;
export type DesignationStatus = (typeof DESIGNATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export interface DesignationStatusMeta {
  label: string;
  description: string;
  tone: "emerald" | "gray";
}

export const DESIGNATION_STATUS_META: Record<
  DesignationStatus,
  DesignationStatusMeta
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

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface Designation {
  id: string;
  /** Human-friendly name, e.g. "Manager" or "Senior Officer". */
  name: string;
  /** FK to the department this designation belongs to. */
  departmentId: string;
  /**
   * Optional short description of the role's responsibilities
   * and reporting line.
   */
  description: string;
  /**
   * Number of employees currently holding this designation.
   * Persisted today for fast KPI rendering; will become a
   * derived count in production.
   */
  employeeCount: number;
  status: DesignationStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

export interface DesignationFormData {
  name: string;
  departmentId: string;
  description: string;
  status: DesignationStatus;
}

// ---------------------------------------------------------------------------
// Aggregate shape returned by the data layer
// ---------------------------------------------------------------------------

export interface DesignationData {
  designations: Designation[];
  departments: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

export function formatDesignationStatus(s: DesignationStatus): string {
  return DESIGNATION_STATUS_META[s].label;
}

export function formatDesignationStatusDescription(s: DesignationStatus): string {
  return DESIGNATION_STATUS_META[s].description;
}

export function formatEmployeeCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return `${n} employee${n === 1 ? "" : "s"}`;
}