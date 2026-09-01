/**
 * Mock seed data for the Pay Head repository.
 *
 * This module exposes:
 *   - `mockPayHeadStore` — a mutable `Map<id, PayHead>` used as
 *     the in-memory data store. The repository layer reads &
 *     writes through this map, so create/update/delete actions
 *     are reflected for the rest of the client session.
 *   - `PayHeadWriteInput` — the shape the repository expects
 *     when creating a pay head (mirrors `PayHead` minus the
 *     auto-generated `id`, `code`, `createdAt`, `updatedAt`).
 *
 * **14 seed pay heads** — the count shown in the screenshot's
 * "Total Heads" KPI card. The mix matches the screenshots:
 *   6 allowances, 8 deductions, 4 statutory.
 *
 * Each seed head is fully described (calc basis, applicability,
 * flags) so the table, KPI cards, and side panel all render
 * meaningful data on first load.
 *
 * **Migration plan to a real DB (Drizzle + Postgres):**
 *   1. Define the schema in `lib/db/schema.ts`:
 *      - `pay_heads` table (id, code, name, type, effect_on_tax,
 *        calc_basis, calc_parameter, calc_percent,
 *        applicable_departments text[],
 *        applicable_designations text[],
 *        flags jsonb, created_at, updated_at)
 *   2. Replace the body of each function in the repository with
 *      a Drizzle query. KEEP the function signatures unchanged.
 *   3. The service layer, the client component, and every test
 *      keep working without any change.
 *
 * **Soft delete (architecture §2.1 + §14):** In production
 * pay heads referenced by locked payslips must NOT be hard-
 * deleted. Today we do hard deletes because no payslips
 * module exists. When that ships, swap to a `deleted_at`
 * column + filtered reads (see repository JSDoc).
 */

import type { PayHead } from "@/lib/types/pay-head";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The shape the repository expects when creating or updating a
 * pay head. Mirrors `PayHead` minus the auto-generated fields.
 */
export interface PayHeadWriteInput {
  name: string;
  type: PayHead["type"];
  effectOnTax: boolean;
  calcBasis: PayHead["calcBasis"];
  calcParameter: PayHead["calcParameter"];
  calcPercent: number;
  applicableDepartmentIds: string[];
  applicableDesignationIds: string[];
  flags: Partial<Record<keyof PayHead["flags"], boolean>>;
}

// ---------------------------------------------------------------------------
// Convenience constants
// ---------------------------------------------------------------------------

/** All seven department ids — matches the 7 departments from mock-departments.ts. */
const ALL_DEPTS = [
  "dept-eng",
  "dept-ops",
  "dept-fin",
  "dept-hr",
  "dept-sales",
  "dept-csupp",
  "dept-log",
];

/** All twenty designation ids — matches the 20 designations from mock-designations.ts. */
const ALL_DESIGS = [
  "desig-eng-manager",
  "desig-eng-senior",
  "desig-eng-officer",
  "desig-eng-junior",
  "desig-ops-manager",
  "desig-ops-officer",
  "desig-ops-assistant",
  "desig-fin-manager",
  "desig-fin-officer",
  "desig-fin-assistant",
  "desig-hr-manager",
  "desig-hr-officer",
  "desig-hr-assistant",
  "desig-sales-manager",
  "desig-sales-officer",
  "desig-sales-assistant",
  "desig-csupp-manager",
  "desig-csupp-officer",
  "desig-log-manager",
  "desig-log-officer",
];

/** Remote Allowance applies only to Engineering + Sales (the remote-friendly depts). */
const REMOTE_DEPTS = ["dept-eng", "dept-sales"];

// ---------------------------------------------------------------------------
// Static ISO timestamps (seed data only — would be NOW() in DB)
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
const TA = "2024-01-15T10:10:00.000Z";
const TB = "2024-01-15T10:11:00.000Z";
const TC = "2024-01-15T10:12:00.000Z";
const TD = "2024-01-15T10:13:00.000Z";

// ---------------------------------------------------------------------------
// Seed fixture (14 rows)
// ---------------------------------------------------------------------------

const SEED: PayHead[] = [
  // -- Allowances (6) ----------------------------------------------------
  {
    id: "ph-001",
    code: "PH-001",
    name: "Basic Salary",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "BasicSalary",
    calcParameter: "BasicSalary",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "ph-002",
    code: "PH-002",
    name: "Grade Allowance",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "BasicPlusGrade",
    calcParameter: "BasicPlusGrade",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: T1,
    updatedAt: T1,
  },
  {
    id: "ph-003",
    code: "PH-003",
    name: "Festival Allowance",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "BasicSalary",
    calcParameter: "BasicSalary",
    calcPercent: 100,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isFestivalAllowance: true },
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "ph-004",
    code: "PH-004",
    name: "Remote Allowance",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...REMOTE_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isRemoteAllowance: true },
    createdAt: T3,
    updatedAt: T3,
  },
  {
    id: "ph-005",
    code: "PH-005",
    name: "Overtime Pay",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "BasicPlusGrade",
    calcParameter: "BasicPlusGrade",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isOtHead: true },
    createdAt: T4,
    updatedAt: T4,
  },
  {
    id: "ph-006",
    code: "PH-006",
    name: "Travel Allowance",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: T5,
    updatedAt: T5,
  },
  // -- Deductions (8) ----------------------------------------------------
  {
    id: "ph-007",
    code: "PH-007",
    name: "Medical Allowance",
    type: "allowance",
    effectOnTax: false,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: T6,
    updatedAt: T6,
  },
  {
    id: "ph-008",
    code: "PH-008",
    name: "Social Security Fund (SSF)",
    type: "deduction",
    effectOnTax: false,
    calcBasis: "BasicSalary",
    calcParameter: "BasicSalary",
    calcPercent: 11,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isSsfHead: true },
    createdAt: T7,
    updatedAt: T7,
  },
  {
    id: "ph-009",
    code: "PH-009",
    name: "CIT Deduction",
    type: "deduction",
    effectOnTax: true,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isCitHead: true },
    createdAt: T8,
    updatedAt: T8,
  },
  {
    id: "ph-010",
    code: "PH-010",
    name: "TDS / Income Tax",
    type: "deduction",
    effectOnTax: false,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isTdsHead: true },
    createdAt: T9,
    updatedAt: T9,
  },
  {
    id: "ph-011",
    code: "PH-011",
    name: "Absent / Leave Deduction",
    type: "deduction",
    effectOnTax: false,
    calcBasis: "BasicPlusGrade",
    calcParameter: "BasicPlusGrade",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: { isAbsentDeduct: true },
    createdAt: TA,
    updatedAt: TA,
  },
  {
    id: "ph-012",
    code: "PH-012",
    name: "Loan Deduction",
    type: "deduction",
    effectOnTax: false,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: TB,
    updatedAt: TB,
  },
  {
    id: "ph-013",
    code: "PH-013",
    name: "Insurance Premium",
    type: "deduction",
    effectOnTax: true,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 0,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: TC,
    updatedAt: TC,
  },
  {
    id: "ph-014",
    code: "PH-014",
    name: "Handicapped Tax Relief",
    type: "deduction",
    effectOnTax: true,
    calcBasis: "None",
    calcParameter: "FixedAmount",
    calcPercent: 50,
    applicableDepartmentIds: [...ALL_DEPTS],
    applicableDesignationIds: [...ALL_DESIGS],
    flags: {},
    createdAt: TD,
    updatedAt: TD,
  },
];

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

/**
 * Module-level in-memory store. The repository reads from /
 * writes to this map. It's pre-populated with seed data and
 * the IDs match the screenshots.
 */
export const mockPayHeadStore: Map<string, PayHead> = (() => {
  const map = new Map<string, PayHead>();
  for (const h of SEED) {
    // Deep-clone flags so accidental in-place mutation by callers
    // doesn't leak between rows.
    map.set(h.id, {
      ...h,
      applicableDepartmentIds: [...h.applicableDepartmentIds],
      applicableDesignationIds: [...h.applicableDesignationIds],
      flags: { ...h.flags },
    });
  }
  return map;
})();
