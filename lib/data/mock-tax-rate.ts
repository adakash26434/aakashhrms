/**
 * Mock seed data for the Tax Rate repository.
 *
 * This module exposes:
 *   - `mockFiscalYearList` — the list of fiscal years (newest-first)
 *   - `mockSlabStore` — a mutable `Map<id, TaxSlab>` used as the
 *     in-memory data store. The repository layer reads & writes
 *     through this map, so create/update/delete actions are
 *     reflected for the rest of the client session.
 *
 * **Per-category distinct ladders.** Each of the four categories
 * (Normal Single, Married, Widow, Handicapped) gets a *different*
 * ladder to mirror real-world Nepali TDS treatment. The data below
 * is sourced from the public IRD schedule and the
 * `System Control` sheet's `Handicamped Dedction Facility%` flag.
 *
 *   Normal Single (screenshot):
 *     0 → 500,000 @ 1%  + NPR 0
 *     500,001 → 700,000 @ 10% + NPR 5,000
 *     700,001 → 2,000,000 @ 20% + NPR 25,000
 *     2,000,001 → Above @ 30% + NPR 285,000
 *
 *   Married (joint — more brackets, lower marginal rate):
 *     0 → 600,000 @ 1%  + NPR 0
 *     600,001 → 800,000 @ 10% + NPR 6,000
 *     800,001 → 2,000,000 @ 20% + NPR 26,000
 *     2,000,001 → 3,000,000 @ 30% + NPR 86,000
 *     3,000,001 → Above @ 36% + NPR 176,000
 *
 *   Widow (first bracket is tax-exempt per the legacy Excel R14):
 *     0 → 500,000 @ 0%  + NPR 0
 *     500,001 → 2,000,000 @ 10% + NPR 0
 *     2,000,001 → Above @ 20% + NPR 150,000
 *
 *   Handicapped (effective rate is ~50% of Normal Single per the
 *   Handicamped Facility 50% system-control flag):
 *     0 → 500,000 @ 1%  + NPR 0
 *     500,001 → 700,000 @ 5% + NPR 2,500
 *     700,001 → 2,000,000 @ 10% + NPR 12,500
 *     2,000,001 → Above @ 15% + NPR 142,500
 */

import type { TaxCategory, TaxSlab } from "@/lib/types/tax-rate";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The shape the repository expects when creating or updating a
 * slab. Mirrors `TaxSlab` minus the auto-generated `id`.
 */
export interface SlabWriteInput {
  fiscalYearId: string;
  fiscalYearLabel: string;
  category: TaxCategory;
  amountFrom: number;
  amountTo: number | null;
  ratePercent: number;
  fixedDeduction: number;
}

// ---------------------------------------------------------------------------
// Fiscal year fixtures
// ---------------------------------------------------------------------------

/** Two fiscal years: one active, one locked. */
export const mockFiscalYearList: { id: string; label: string; isLocked: boolean }[] = [
  { id: "fy-2081-82", label: "FY 2081/82", isLocked: false },
  { id: "fy-2080-81", label: "FY 2080/81", isLocked: true },
];

// ---------------------------------------------------------------------------
// Slab fixture data
// ---------------------------------------------------------------------------

/**
 * Type for a single ladder entry. We build `TaxSlab[]` from this at
 * module load time.
 */
type LadderSpec = Array<Omit<TaxSlab, "id" | "fiscalYearId" | "fiscalYearLabel" | "category">>;

/** Per-category ladders keyed by TaxCategory. */
const LADDERS: Record<TaxCategory, LadderSpec> = {
  "Normal Single": [
    { amountFrom: 0, amountTo: 500_000, ratePercent: 1, fixedDeduction: 0 },
    { amountFrom: 500_001, amountTo: 700_000, ratePercent: 10, fixedDeduction: 5_000 },
    { amountFrom: 700_001, amountTo: 2_000_000, ratePercent: 20, fixedDeduction: 25_000 },
    { amountFrom: 2_000_001, amountTo: null, ratePercent: 30, fixedDeduction: 285_000 },
  ],
  Married: [
    { amountFrom: 0, amountTo: 600_000, ratePercent: 1, fixedDeduction: 0 },
    { amountFrom: 600_001, amountTo: 800_000, ratePercent: 10, fixedDeduction: 6_000 },
    { amountFrom: 800_001, amountTo: 2_000_000, ratePercent: 20, fixedDeduction: 26_000 },
    { amountFrom: 2_000_001, amountTo: 3_000_000, ratePercent: 30, fixedDeduction: 86_000 },
    { amountFrom: 3_000_001, amountTo: null, ratePercent: 36, fixedDeduction: 176_000 },
  ],
  Widow: [
    { amountFrom: 0, amountTo: 500_000, ratePercent: 0, fixedDeduction: 0 },
    { amountFrom: 500_001, amountTo: 2_000_000, ratePercent: 10, fixedDeduction: 0 },
    { amountFrom: 2_000_001, amountTo: null, ratePercent: 20, fixedDeduction: 150_000 },
  ],
  Handicapped: [
    { amountFrom: 0, amountTo: 500_000, ratePercent: 1, fixedDeduction: 0 },
    { amountFrom: 500_001, amountTo: 700_000, ratePercent: 5, fixedDeduction: 2_500 },
    { amountFrom: 700_001, amountTo: 2_000_000, ratePercent: 10, fixedDeduction: 12_500 },
    { amountFrom: 2_000_001, amountTo: null, ratePercent: 15, fixedDeduction: 142_500 },
  ],
};

const CATEGORIES: TaxCategory[] = [
  "Normal Single",
  "Married",
  "Widow",
  "Handicapped",
];

function buildSeedSlabsForFY(fiscalYearId: string, fiscalYearLabel: string): TaxSlab[] {
  const slabs: TaxSlab[] = [];
  for (const category of CATEGORIES) {
    const ladder = LADDERS[category];
    ladder.forEach((row, idx) => {
      slabs.push({
        id: `${fiscalYearId}-${category.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
        fiscalYearId,
        fiscalYearLabel,
        category,
        amountFrom: row.amountFrom,
        amountTo: row.amountTo,
        ratePercent: row.ratePercent,
        fixedDeduction: row.fixedDeduction,
      });
    });
  }
  return slabs;
}

/**
 * Module-level in-memory store. The repository reads from / writes
 * to this map. It's pre-populated with seed data for both fiscal
 * years.
 */
export const mockSlabStore: Map<string, TaxSlab> = (() => {
  const map = new Map<string, TaxSlab>();
  for (const fy of mockFiscalYearList) {
    for (const slab of buildSeedSlabsForFY(fy.id, fy.label)) {
      map.set(slab.id, slab);
    }
  }
  return map;
})();

/**
 * **Deprecated** — kept as a thin re-export of the pre-built
 * snapshot for any code that imports `mockTaxRateData` directly.
 * New code should go through the repository instead.
 *
 * @deprecated Use `taxRateRepository.findAllSlabs()` and
 *   `taxRateRepository.findAllFiscalYears()` instead.
 */
export const mockTaxRateData = {
  fiscalYears: mockFiscalYearList,
  /** Snapshot only — for old call sites. The live store is `mockSlabStore`. */
  get slabs(): TaxSlab[] {
    return Array.from(mockSlabStore.values());
  },
};

/**
 * Async data getter used by the server component (`page.tsx`).
 * Kept for backwards-compat with the original page wiring. New
 * server-side code should call the service layer instead.
 *
 * @deprecated Use the service layer.
 */
export async function getTaxRateData(): Promise<{
  fiscalYears: { id: string; label: string; isLocked: boolean }[];
  slabs: TaxSlab[];
}> {
  return {
    fiscalYears: mockFiscalYearList,
    slabs: Array.from(mockSlabStore.values()),
  };
}
