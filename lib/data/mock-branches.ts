/**
 * Mock seed data for the Branch repository.
 *
 * Exposes:
 *   - `mockBranches` — the lightweight `{id, name}` list
 *     used by the Department, Holiday, and Pay Head pickers.
 *   - `mockBranchStore` — a mutable `Map<id, Branch>`
 *     used as the in-memory data store for the Branch Setup
 *     tab. Pre-populated with 4 seed branches.
 *
 * 4 seed branches matching the design screenshots.
 */

import type { Branch } from "@/lib/types/branch";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BranchWriteInput {
  code: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  status: Branch["status"];
}

// ---------------------------------------------------------------------------
// Lightweight `{id, name}` list (kept for backwards compat)
// ---------------------------------------------------------------------------

export interface MockBranch {
  id: string;
  name: string;
}

export const mockBranches: MockBranch[] = [
  { id: "branch-kathmandu", name: "Kathmandu HQ" },
  { id: "branch-pokhara", name: "Pokhara Branch" },
  { id: "branch-biratnagar", name: "Biratnagar Branch" },
  { id: "branch-butwal", name: "Butwal Branch" },
];

// ---------------------------------------------------------------------------
// Static ISO timestamps
// ---------------------------------------------------------------------------

const T0 = "2024-01-15T10:00:00.000Z";
const T1 = "2024-01-15T10:01:00.000Z";
const T2 = "2024-01-15T10:02:00.000Z";
const T3 = "2024-01-15T10:03:00.000Z";

const SEED: Branch[] = [
  {
    id: "branch-kathmandu",
    code: "KTM",
    name: "Kathmandu HQ",
    location: "Lalitpur, Kathmandu Valley",
    phone: "01-4XXXXXX",
    email: "kathmandu@aakashhrms.com",
    status: "active",
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "branch-pokhara",
    code: "PKH",
    name: "Pokhara Branch",
    location: "Pokhara-10, Kaski",
    phone: "061-5XXXXX",
    email: "pokhara@aakashhrms.com",
    status: "active",
    createdAt: T1,
    updatedAt: T1,
  },
  {
    id: "branch-biratnagar",
    code: "BRT",
    name: "Biratnagar Branch",
    location: "Biratnagar-3, Morang",
    phone: "021-4XXXXX",
    email: "biratnagar@aakashhrms.com",
    status: "active",
    createdAt: T2,
    updatedAt: T2,
  },
  {
    id: "branch-butwal",
    code: "BTL",
    name: "Butwal Branch",
    location: "Butwal-8, Rupandehi",
    phone: "071-5XXXXX",
    email: "butwal@aakashhrms.com",
    status: "inactive",
    createdAt: T3,
    updatedAt: T3,
  },
];

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

export const mockBranchStore: Map<string, Branch> = (() => {
  const map = new Map<string, Branch>();
  for (const b of SEED) {
    map.set(b.id, { ...b });
  }
  return map;
})();