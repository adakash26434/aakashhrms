/**
 * Mock seed data for the Department repository.
 *
 * Exposes:
 *   - `mockDepartments` — the lightweight `{id, name}` list
 *     used by the Pay Head "Applicable Departments" picker
 *     (and any other module that only needs a label). This
 *     is what the previous version of this file exported,
 *     so the pay-head service keeps working unchanged.
 *   - `mockDepartmentStore` — a mutable `Map<id, Department>`
 *     used as the in-memory data store for the Department
 *     Setup page. Pre-populated with the 7 design rows
 *     (Engineering, Operations, Finance & Accounts, Admin &
 *     HR, Field Sales, Customer Support, Logistics & Supply
 *     Chain).
 *   - `DepartmentWriteInput` — the shape the repository
 *     expects when creating a department (mirrors
 *     `Department` minus the auto-generated `id`,
 *     `createdAt`, `updatedAt`, and the denormalized counts
 *     that the service layer manages).
 *
 * **Why two exports?** The pay-head picker only needs
 * `{id, name}` to label its checkboxes. The Department Setup
 * page needs the full record (with counts, status, branch FK,
 * etc.). Both are derived from the same seed so the picker
 * stays in sync with the page automatically.
 *
 * **7 seed departments**, matching the design screenshots:
 *
 *   | Code   | Name                       | Branch       | Head              | #Pos | #Emp |
 *   |--------|----------------------------|--------------|-------------------|------|------|
 *   | ENG    | Engineering                | Kathmandu HQ | Pratima Shrestha  |   4  |   4  |
 *   | OPS    | Operations                 | Kathmandu HQ | Bibek Lamichhane  |   3  |   3  |
 *   | FIN    | Finance & Accounts         | Kathmandu HQ | Sushant Adhikari  |   3  |   0  |
 *   | HR-ADM | Admin & HR                 | Kathmandu HQ | Anjali Karki      |   3  |   3  |
 *   | SALES  | Field Sales                | Kathmandu HQ | Bimal Acharya     |   3  |   3  |
 *   | CSUPP  | Customer Support           | Kathmandu HQ | Maya Chaudhary    |   2  |   2  |
 *   | LOG    | Logistics & Supply Chain   | Kathmandu HQ | Nabin Sharma      |   2  |   0  |
 *
 *   Total designations = 4+3+3+3+3+2+2 = 20  → matches the
 *   "Designations 20" KPI tab in the design.
 *   Total employees    = 4+3+0+3+3+2+0 = 15  → within the
 *   1,284 workforce shown in the sidebar (the rest live in
 *   branches without a department assignment, which the
 *   architecture allows for).
 *
 * **Migration plan to a real DB (Drizzle + Postgres):**
 *   1. Define the schema in `lib/db/schema.ts`:
 *      - `departments` table (id, code, name, branch_id,
 *        head_name, designation_count, employee_count,
 *        description, status, created_at, updated_at)
 *      - Unique indexes on `code` and `name`.
 *   2. Replace the body of each function in
 *      `lib/repositories/department.repository.ts` with a
 *      Drizzle query. KEEP the function signatures unchanged.
 *   3. The service layer, the client component, and every
 *      test keep working without any change.
 *
 * **Soft delete (architecture §2.1 + §14):** When the
 * Employees module ships, hard-delete may need to be replaced
 * with a `deleted_at` column + filtered reads so historical
 * payslips don't break. For now we hard-delete — see the
 * repository's TODO.
 */

import type { Department } from "@/lib/types/department";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The shape the repository expects when creating or updating
 * a department. Mirrors `Department` minus the auto-generated
 * fields (id, createdAt, updatedAt) and minus the denormalized
 * counters (designationCount, employeeCount), which the
 * service layer manages from cross-table aggregates once the
 * Designation and Employee modules exist.
 */
export interface DepartmentWriteInput {
  code: string;
  name: string;
  branchId: string;
  headName: string;
  description: string;
  status: Department["status"];
}

// ---------------------------------------------------------------------------
// Lightweight `{id, name}` list
// ---------------------------------------------------------------------------

/**
 * The minimal label-only list. Used by the Pay Head "Applicable
 * Departments" picker. Kept as a separate export (rather than a
 * derived `.map(d => ({ id, name }))` at every call site) so
 * downstream modules can import the same constant and stay
 * perfectly in sync with the full department store.
 *
 * Re-exported with the historical `MockDepartment` type alias
 * to keep the pay-head service's existing import working.
 */
export interface MockDepartment {
  id: string;
  name: string;
}

export const mockDepartments: MockDepartment[] = [
  { id: "dept-eng", name: "Engineering" },
  { id: "dept-ops", name: "Operations" },
  { id: "dept-fin", name: "Finance & Accounts" },
  { id: "dept-hr", name: "Admin & HR" },
  { id: "dept-sales", name: "Field Sales" },
  { id: "dept-csupp", name: "Customer Support" },
  { id: "dept-log", name: "Logistics & Supply Chain" },
];

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

/** The only branch in the seed — every department is HQ'd in Kathmandu. */
const BRANCH_KATHMANDU = "branch-kathmandu";

// ---------------------------------------------------------------------------
// Seed fixture (7 rows)
// ---------------------------------------------------------------------------

const SEED: Department[] = [
  {
    id: "dept-eng",
    code: "ENG",
    name: "Engineering",
    branchId: BRANCH_KATHMANDU,
    headName: "Pratima Shrestha",
    designationCount: 4,
    employeeCount: 4,
    description:
      "Software engineering, QA, DevOps, and IT infrastructure for all branch systems and digital products.",
    status: "active",
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "dept-ops",
    code: "OPS",
    name: "Operations",
    branchId: BRANCH_KATHMANDU,
    headName: "Bibek Lamichhane",
    designationCount: 3,
    employeeCount: 3,
    description:
      "Day-to-day business operations, vendor management, and process governance across the organization.",
    status: "active",
    createdAt: T1,
    updatedAt: T1,
  },
  {
    id: "dept-fin",
    code: "FIN",
    name: "Finance & Accounts",
    branchId: BRANCH_KATHMANDU,
    headName: "Sushant Adhikari",
    designationCount: 3,
    employeeCount: 0,
    description:
      "Accounts payable / receivable, statutory filings, treasury, and financial reporting.",
    status: "active",
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "dept-hr",
    code: "HR-ADM",
    name: "Admin & HR",
    branchId: BRANCH_KATHMANDU,
    headName: "Anjali Karki",
    designationCount: 3,
    employeeCount: 3,
    description:
      "People operations, hiring, payroll administration, and general office administration.",
    status: "active",
    createdAt: T3,
    updatedAt: T3,
  },
  {
    id: "dept-sales",
    code: "SALES",
    name: "Field Sales",
    branchId: BRANCH_KATHMANDU,
    headName: "Bimal Acharya",
    designationCount: 3,
    employeeCount: 3,
    description:
      "Direct and channel sales, lead generation, and on-site customer relationship management.",
    status: "active",
    createdAt: T4,
    updatedAt: T4,
  },
  {
    id: "dept-csupp",
    code: "CSUPP",
    name: "Customer Support",
    branchId: BRANCH_KATHMANDU,
    headName: "Maya Chaudhary",
    designationCount: 2,
    employeeCount: 2,
    description:
      "Frontline customer support, ticket triage, and post-sale service operations.",
    status: "active",
    createdAt: T5,
    updatedAt: T5,
  },
  {
    id: "dept-log",
    code: "LOG",
    name: "Logistics & Supply Chain",
    branchId: BRANCH_KATHMANDU,
    headName: "Nabin Sharma",
    designationCount: 2,
    employeeCount: 0,
    description:
      "Inbound and outbound logistics, warehouse operations, and supplier coordination.",
    status: "active",
    createdAt: T6,
    updatedAt: T6,
  },
];

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

/**
 * Module-level in-memory store. The repository reads from /
 * writes to this map. It's pre-populated with seed data and
 * the IDs match the design's visual order (Engineering
 * first, Operations second, …).
 *
 * We expose the store as a `Map<string, Department>` (rather
 * than a plain object) so iteration order is insertion order.
 * The service layer sorts the list before rendering, so
 * insertion order is only a debugging convenience.
 */
export const mockDepartmentStore: Map<string, Department> = (() => {
  const map = new Map<string, Department>();
  for (const d of SEED) {
    // Clone the record so accidental in-place mutation by
    // callers doesn't leak between rows. The fields we have
    // are all primitives or strings, so a shallow spread is
    // sufficient.
    map.set(d.id, { ...d });
  }
  return map;
})();
