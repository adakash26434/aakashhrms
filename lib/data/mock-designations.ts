/**
 * Mock seed data for the Designation repository.
 *
 * Exposes:
 *   - `mockDesignationStore` — a mutable `Map<id, Designation>`
 *     used as the in-memory data store for the Designation
 *     Setup page. Pre-populated with seed entries.
 *
 * 14 seed designations across the 7 departments, matching the
 * pay-head module's existing lightweight `MockDesignation` list
 * (Manager, Assistant Manager, Officer, Senior Officer, Junior
 * Officer, Assistant, CEO) plus per-department positions.
 */

import type { Designation } from "@/lib/types/designation";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DesignationWriteInput {
  name: string;
  departmentId: string;
  description: string;
  status: Designation["status"];
}

// ---------------------------------------------------------------------------
// Lightweight `{id, name}` list
// ---------------------------------------------------------------------------

/**
 * The minimal label-only list, used by the Pay Head "Applicable
 * Positions" picker. Kept as a separate export so downstream
 * modules can import the same constant and stay perfectly in sync
 * with the full designation store.
 *
 * Re-exported with the `MockDesignation` type alias to keep the
 * pay-head service's existing import working.
 */
export interface MockDesignation {
  id: string;
  name: string;
}

export const mockDesignations: MockDesignation[] = [
  { id: "desig-eng-manager", name: "Engineering Manager" },
  { id: "desig-eng-senior", name: "Senior Engineer" },
  { id: "desig-eng-officer", name: "Engineer" },
  { id: "desig-eng-junior", name: "Junior Engineer" },
  { id: "desig-devops", name: "DevOps Engineer" },
  { id: "desig-ops-manager", name: "Operations Manager" },
  { id: "desig-ops-officer", name: "Operations Officer" },
  { id: "desig-ops-assistant", name: "Operations Assistant" },
  { id: "desig-fin-manager", name: "Finance Manager" },
  { id: "desig-fin-officer", name: "Finance Officer" },
  { id: "desig-fin-assistant", name: "Finance Assistant" },
  { id: "desig-hr-manager", name: "HR Manager" },
  { id: "desig-hr-officer", name: "HR Officer" },
  { id: "desig-hr-assistant", name: "HR Assistant" },
  { id: "desig-sales-manager", name: "Sales Manager" },
  { id: "desig-sales-officer", name: "Sales Officer" },
  { id: "desig-sales-assistant", name: "Sales Assistant" },
  { id: "desig-csupp-manager", name: "Support Manager" },
  { id: "desig-csupp-officer", name: "Support Officer" },
  { id: "desig-log-manager", name: "Logistics Manager" },
  { id: "desig-log-officer", name: "Logistics Officer" },
];

// ---------------------------------------------------------------------------
// Static ISO timestamps
// ---------------------------------------------------------------------------

const T0 = "2024-01-15T10:00:00.000Z";
const T1 = "2024-01-15T10:01:00.000Z";
const T2 = "2024-01-15T10:02:00.000Z";
const T3 = "2024-01-15T10:03:00.000Z";
const T4 = "2024-01-15T10:04:00.000Z";
const T5 = "2024-01-15T10:05:00.000Z";
const T6 = "2024-01-15T10:06:00.000Z";
const T7 = "2024-01-15T10:07:00.000Z";
const T8 = "2024-01-15T10:08:00.000Z";
const T9 = "2024-01-15T10:09:00.000Z";
const T10 = "2024-01-15T10:10:00.000Z";
const T11 = "2024-01-15T10:11:00.000Z";
const T12 = "2024-01-15T10:12:00.000Z";
const T13 = "2024-01-15T10:13:00.000Z";

const SEED: Designation[] = [
  // -- Engineering (4 designations) -----------------------------------------
  {
    id: "desig-eng-manager",
    name: "Engineering Manager",
    departmentId: "dept-eng",
    description: "Leads the engineering team, oversees architecture and delivery.",
    employeeCount: 1,
    status: "active",
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "desig-eng-senior",
    name: "Senior Engineer",
    departmentId: "dept-eng",
    description: "Senior software developer handling complex modules and mentoring.",
    employeeCount: 1,
    status: "active",
    createdAt: T1,
    updatedAt: T1,
  },
  {
    id: "desig-eng-officer",
    name: "Engineer",
    departmentId: "dept-eng",
    description: "Software developer working on feature implementation and bug fixes.",
    employeeCount: 1,
    status: "active",
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "desig-eng-junior",
    name: "Junior Engineer",
    departmentId: "dept-eng",
    description: "Entry-level developer learning the codebase and toolchain.",
    employeeCount: 1,
    status: "active",
    createdAt: T3,
    updatedAt: T3,
  },

  // -- Operations (3 designations) ------------------------------------------
  {
    id: "desig-ops-manager",
    name: "Operations Manager",
    departmentId: "dept-ops",
    description: "Oversees daily operations, vendor contracts, and process compliance.",
    employeeCount: 1,
    status: "active",
    createdAt: T4,
    updatedAt: T4,
  },
  {
    id: "desig-ops-officer",
    name: "Operations Officer",
    departmentId: "dept-ops",
    description: "Executes operational workflows and vendor coordination.",
    employeeCount: 1,
    status: "active",
    createdAt: T5,
    updatedAt: T5,
  },
  {
    id: "desig-ops-assistant",
    name: "Operations Assistant",
    departmentId: "dept-ops",
    description: "Supports operational tasks and document management.",
    employeeCount: 1,
    status: "active",
    createdAt: T6,
    updatedAt: T6,
  },

  // -- Finance & Accounts (3 designations) ----------------------------------
  {
    id: "desig-fin-manager",
    name: "Finance Manager",
    departmentId: "dept-fin",
    description: "Manages financial reporting, budgeting, and statutory compliance.",
    employeeCount: 0,
    status: "active",
    createdAt: T7,
    updatedAt: T7,
  },
  {
    id: "desig-fin-officer",
    name: "Finance Officer",
    departmentId: "dept-fin",
    description: "Handles accounts payable/receivable and reconciliations.",
    employeeCount: 0,
    status: "active",
    createdAt: T8,
    updatedAt: T8,
  },
  {
    id: "desig-fin-assistant",
    name: "Finance Assistant",
    departmentId: "dept-fin",
    description: "Assists with data entry, invoicing, and filing.",
    employeeCount: 0,
    status: "active",
    createdAt: T9,
    updatedAt: T9,
  },

  // -- Admin & HR (3 designations) ------------------------------------------
  {
    id: "desig-hr-manager",
    name: "HR Manager",
    departmentId: "dept-hr",
    description: "Leads people operations, hiring, and payroll administration.",
    employeeCount: 1,
    status: "active",
    createdAt: T10,
    updatedAt: T10,
  },
  {
    id: "desig-hr-officer",
    name: "HR Officer",
    departmentId: "dept-hr",
    description: "Executes recruitment, onboarding, and employee relations.",
    employeeCount: 1,
    status: "active",
    createdAt: T11,
    updatedAt: T11,
  },
  {
    id: "desig-hr-assistant",
    name: "HR Assistant",
    departmentId: "dept-hr",
    description: "Supports HR operations, record-keeping, and correspondence.",
    employeeCount: 1,
    status: "active",
    createdAt: T12,
    updatedAt: T12,
  },

  // -- Field Sales (3 designations) -----------------------------------------
  {
    id: "desig-sales-manager",
    name: "Sales Manager",
    departmentId: "dept-sales",
    description: "Drives sales strategy, targets, and team performance.",
    employeeCount: 1,
    status: "active",
    createdAt: T13,
    updatedAt: T13,
  },
  {
    id: "desig-sales-officer",
    name: "Sales Officer",
    departmentId: "dept-sales",
    description: "Field sales execution and lead conversion.",
    employeeCount: 1,
    status: "active",
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "desig-sales-assistant",
    name: "Sales Assistant",
    departmentId: "dept-sales",
    description: "Supports sales documentation and customer follow-ups.",
    employeeCount: 1,
    status: "active",
    createdAt: T1,
    updatedAt: T1,
  },

  // -- Customer Support (2 designations) ------------------------------------
  {
    id: "desig-csupp-manager",
    name: "Support Manager",
    departmentId: "dept-csupp",
    description: "Manages support tickets, SLAs, and team scheduling.",
    employeeCount: 1,
    status: "active",
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "desig-csupp-officer",
    name: "Support Officer",
    departmentId: "dept-csupp",
    description: "Frontline ticket handling and customer resolution.",
    employeeCount: 1,
    status: "active",
    createdAt: T3,
    updatedAt: T3,
  },

  // -- Logistics & Supply Chain (2 designations) ----------------------------
  {
    id: "desig-log-manager",
    name: "Logistics Manager",
    departmentId: "dept-log",
    description: "Oversees supply chain, warehousing, and distribution.",
    employeeCount: 0,
    status: "active",
    createdAt: T4,
    updatedAt: T4,
  },
  {
    id: "desig-log-officer",
    name: "Logistics Officer",
    departmentId: "dept-log",
    description: "Coordinates shipments, inventory, and supplier communication.",
    employeeCount: 0,
    status: "active",
    createdAt: T5,
    updatedAt: T5,
  },
];

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

export const mockDesignationStore: Map<string, Designation> = (() => {
  const map = new Map<string, Designation>();
  for (const d of SEED) {
    map.set(d.id, { ...d });
  }
  return map;
})();