/**
 * Mock seed data for the Holiday repository.
 *
 * Exposes:
 *   - `mockHolidayStore` — a mutable `Map<id, Holiday>` used as
 *     the in-memory data store. The repository reads & writes
 *     through this map, so create/update/delete actions are
 *     reflected for the rest of the client session.
 *   - `HolidayWriteInput` — the shape the repository expects
 *     when creating a holiday (mirrors `Holiday` minus the
 *     auto-generated `id`, `createdAt`, `updatedAt`).
 *
 * **12 seed holidays** for fiscal year 2081/82, matching the
 * design screenshots exactly. The mix is:
 *   - 5 multi-day festivals (Dashain 8d, Tihar 5d, Chhath 2d,
 *     Holi 2d, Indra Jatra 2d)
 *   - 5 single-day observances (Maghe Sankranti, Shree Panchami,
 *     Ghode Jatra, New Year, Labour Day, Republic Day, Constitution
 *     Day)  → 7 single-day holidays
 *   - 9 with `branchIds = []` ("All Branches")
 *   - 3 with specific branch assignments:
 *       Chhath            → Biratnagar Branch, Butwal Branch
 *       Ghode Jatra       → Kathmandu HQ, Pokhara Branch
 *       Indra Jatra       → Kathmandu HQ
 *
 * Total days = 8 + 5 + 2 + 1 + 1 + 2 + 1 + 1 + 1 + 1 + 1 + 2 = 26
 *
 * **Date storage:** BS ISO strings. The UI's "AD equivalent" is
 * derived at display time via `lib/utils/bs-calendar.ts`. Keeping
 * BS as the source of truth means sorting and day-counting work
 * in BS space without round-tripping to JS `Date` (which can
 * lose a day around midnight in the user's timezone).
 *
 * **Migration plan to a real DB (Drizzle + Postgres):**
 *   1. Define the schema in `lib/db/schema.ts`:
 *      - `holidays` table (id, name, category, start_date, end_date,
 *        branch_ids text[], created_at, updated_at)
 *   2. Replace the body of each function in the repository with
 *      a Drizzle query. KEEP the function signatures unchanged.
 *   3. The service layer, the client component, and every test
 *      keep working without any change.
 *
 * **Soft delete:** the architecture doc §2.1 + §14 mandate that
 * holidays referenced by locked payslips must NOT be hard-deleted.
 * Today we do hard deletes because no payslips module exists. When
 * that ships, swap to a `deleted_at` column + filtered reads.
 */

import type { Holiday } from "@/lib/types/holiday";
import { bsStringToAD } from "@/lib/utils/bs-calendar";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The shape the repository expects when creating or updating a
 * holiday. Mirrors `Holiday` minus the auto-generated fields.
 */
export interface HolidayWriteInput {
  name: string;
  category: Holiday["category"];
  startDate: string;
  endDate: string;
  branchIds: string[];
}

// ---------------------------------------------------------------------------
// Convenience constants
// ---------------------------------------------------------------------------

/** Sentinel for "applies to all branches" — empty branch list. */
const ALL_BRANCHES: string[] = [];

/** Sentinel for "applies to every defined branch" — used in tests. */
const BRANCHES_KATHMANDU = ["branch-kathmandu"];
const BRANCHES_KATHMANDU_POKHARA = ["branch-kathmandu", "branch-pokhara"];
const BRANCHES_BIRATNAGAR_BUTWAL = ["branch-biratnagar", "branch-butwal"];

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

// ---------------------------------------------------------------------------
// Seed fixture (12 rows)
// ---------------------------------------------------------------------------

const SEED: Omit<Holiday, "startDateAD" | "endDateAD">[] = [
  // -- Major Festivals (2) ------------------------------------------------
  {
    id: "hol-001",
    name: "Dashain",
    category: "major-festival",
    startDate: "2081-06-15",
    endDate: "2081-06-22",
    branchIds: [...ALL_BRANCHES],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "hol-002",
    name: "Tihar",
    category: "major-festival",
    startDate: "2081-07-01",
    endDate: "2081-07-05",
    branchIds: [...ALL_BRANCHES],
    createdAt: T1,
    updatedAt: T1,
  },
  // -- Cultural Festivals (2) --------------------------------------------
  {
    id: "hol-003",
    name: "Maghe Sankranti",
    category: "cultural-festival",
    startDate: "2081-09-15",
    endDate: "2081-09-15",
    branchIds: [...ALL_BRANCHES],
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "hol-004",
    name: "Shree Panchami",
    category: "cultural-festival",
    startDate: "2081-10-05",
    endDate: "2081-10-05",
    branchIds: [...ALL_BRANCHES],
    createdAt: T3,
    updatedAt: T3,
  },
  // -- Regional Festivals (4) --------------------------------------------
  {
    id: "hol-005",
    name: "Chhath",
    category: "regional-festival",
    startDate: "2081-07-07",
    endDate: "2081-07-08",
    branchIds: [...BRANCHES_BIRATNAGAR_BUTWAL],
    createdAt: T4,
    updatedAt: T4,
  },
  {
    id: "hol-006",
    name: "Holi",
    category: "regional-festival",
    startDate: "2081-11-20",
    endDate: "2081-11-21",
    branchIds: [...ALL_BRANCHES],
    createdAt: T5,
    updatedAt: T5,
  },
  {
    id: "hol-007",
    name: "Ghode Jatra",
    category: "regional-festival",
    startDate: "2081-12-10",
    endDate: "2081-12-10",
    branchIds: [...BRANCHES_KATHMANDU_POKHARA],
    createdAt: T6,
    updatedAt: T6,
  },
  {
    id: "hol-008",
    name: "Indra Jatra",
    category: "regional-festival",
    startDate: "2081-05-10",
    endDate: "2081-05-11",
    branchIds: [...BRANCHES_KATHMANDU],
    createdAt: T7,
    updatedAt: T7,
  },
  // -- National Holidays (3) ---------------------------------------------
  {
    id: "hol-009",
    name: "New Year (Bikram Sambat)",
    category: "national-holiday",
    startDate: "2081-12-31",
    endDate: "2081-12-31",
    branchIds: [...ALL_BRANCHES],
    createdAt: T8,
    updatedAt: T8,
  },
  {
    id: "hol-010",
    name: "Republic Day",
    category: "national-holiday",
    startDate: "2081-11-15",
    endDate: "2081-11-15",
    branchIds: [...ALL_BRANCHES],
    createdAt: T9,
    updatedAt: T9,
  },
  {
    id: "hol-011",
    name: "Constitution Day",
    category: "national-holiday",
    startDate: "2081-03-03",
    endDate: "2081-03-03",
    branchIds: [...ALL_BRANCHES],
    createdAt: TA,
    updatedAt: TA,
  },
  // -- International Holidays (1) ----------------------------------------
  {
    id: "hol-012",
    name: "Labour Day",
    category: "international-holiday",
    startDate: "2081-10-01",
    endDate: "2081-10-01",
    branchIds: [...ALL_BRANCHES],
    createdAt: TB,
    updatedAt: TB,
  },
];

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

/**
 * Module-level in-memory store. The repository reads from / writes
 * to this map. It's pre-populated with seed data and the IDs match
 * the screenshots' visual order (Dashain first, Tihar second, …).
 *
 * We expose the store as a `Map<string, Holiday>` (rather than a
 * plain object) so the iteration order is insertion order — which
 * matches the natural "newest first / by date" display the page
 * uses. The service layer sorts the list before rendering, so
 * insertion order is only a debugging convenience.
 */
export const mockHolidayStore: Map<string, Holiday> = (() => {
  const map = new Map<string, Holiday>();
  for (const h of SEED) {
    // Deep-clone branchIds so accidental in-place mutation by
    // callers doesn't leak between rows.
    map.set(h.id, {
      ...h,
      startDateAD: bsStringToAD(h.startDate) || new Date(),
      endDateAD: bsStringToAD(h.endDate) || new Date(),
      branchIds: [...h.branchIds],
    });
  }
  return map;
})();
