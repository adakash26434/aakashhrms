/**
 * Tax Rate Setup — domain types.
 *
 * Each Nepali fiscal year has a full set of slab-based TDS rates for
 * four employee categories. Slabs drive:
 *   - Monthly TDS estimation (annualised gross -> apply_slab() -> /12)
 *   - Year-end reconciliation (last month of FY true-up)
 *
 * The `amountTo = null` case represents the open-ended final slab
 * displayed as "Above" in the UI.
 *
 * Architectural note: a category is considered "configured" for a
 * given fiscal year if it has at least one slab. This drives the
 * "Categories Configured" KPI.
 */

export const TAX_CATEGORIES = [
  "Normal Single",
  "Married",
  "Widow",
  "Handicapped",
] as const;

export type TaxCategory = (typeof TAX_CATEGORIES)[number];

/**
 * A single tax slab — a contiguous income bracket with a flat
 * marginal rate and a fixed deduction.
 *
 * The fixed deduction is the lump-sum amount that is SUBTRACTED from
 * the computed tax for that bracket (per the Nepali TDS structure
 * shown in the legacy Excel sheet).
 */
export interface TaxSlab {
  id: string;
  /** Fiscal year the slab belongs to (e.g. "fy-2081-82"). */
  fiscalYearId: string;
  /** Human label for the FY (e.g. "FY 2081/82"). */
  fiscalYearLabel: string;
  category: TaxCategory;
  /** Lower bound of the bracket in NPR (inclusive). */
  amountFrom: number;
  /** Upper bound in NPR, or `null` for the open-ended "Above" bracket. */
  amountTo: number | null;
  /** Marginal tax rate, 0–100. */
  ratePercent: number;
  /** Lump-sum deduction applied within this bracket, in NPR. */
  fixedDeduction: number;
}

/**
 * Aggregate shape returned by the data layer. `fiscalYears` powers
 * the FY selector in the hero; `slabs` is the full set across all
 * categories and years.
 */
export interface TaxRateData {
  fiscalYears: { id: string; label: string; isLocked: boolean }[];
  slabs: TaxSlab[];
}

/**
 * Subset of `TaxSlab` driven by the create/edit form. The
 * `amountTo = null` case means unlimited ("Above" / open-ended).
 */
export interface TaxSlabFormData {
  amountFrom: number;
  amountTo: number | null;
  ratePercent: number;
  fixedDeduction: number;
}

/**
 * Pretty-format a slab rate as a percent pill label.
 * Example: 10 -> "10%", 7.5 -> "7.5%".
 */
export function formatRateLabel(rate: number): string {
  // Drop trailing zeros for whole numbers (10 -> "10%"), but keep
  // fractional values exact (7.5 -> "7.5%").
  const isWhole = Number.isInteger(rate);
  return `${isWhole ? rate.toString() : rate.toString()}%`;
}

/**
 * Format an integer NPR amount with thousand separators.
 * Example: 500000 -> "500,000".
 */
export function formatNPRAmount(value: number): string {
  return value.toLocaleString("en-IN");
}
