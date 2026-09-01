/**
 * Branch Setup — domain types.
 *
 * A Branch represents a physical office location of the
 * organisation. Every department and employee belongs to
 * exactly one branch. Branches are used for payroll scoping,
 * reporting, and regional compliance.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const BRANCH_STATUSES = ["active", "inactive"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export interface BranchStatusMeta {
  label: string;
  description: string;
  tone: "emerald" | "gray";
}

export const BRANCH_STATUS_META: Record<BranchStatus, BranchStatusMeta> = {
  active: {
    label: "Active",
    description: "Branch is operational and accepting employees.",
    tone: "emerald",
  },
  inactive: {
    label: "Inactive",
    description: "Branch is closed. Existing employee records are preserved.",
    tone: "gray",
  },
};

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface Branch {
  id: string;
  /** Short code, e.g. "KTM", "PKH", "BRT". */
  code: string;
  /** Human-friendly name, e.g. "Kathmandu HQ". */
  name: string;
  /** Physical location / address of the branch. */
  location: string;
  /** Contact phone number. */
  phone: string;
  /** Contact email address. */
  email: string;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

export interface BranchFormData {
  code: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  status: BranchStatus;
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

export function formatBranchStatus(s: BranchStatus): string {
  return BRANCH_STATUS_META[s].label;
}

export function formatBranchStatusDescription(s: BranchStatus): string {
  return BRANCH_STATUS_META[s].description;
}