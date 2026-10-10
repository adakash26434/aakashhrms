/**
 * Tax slabs — domain types.
 *
 * Each Nepali fiscal year has a ladder of income tax bands per category.
 * Payroll's TDS reads them (projection over the months left, year-end
 * reconciliation). The `amountTo = null` band is the open-ended last one.
 */

export const TAX_CATEGORIES = [
  "Normal Single",
  "Married",
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

// ---------------------------------------------------------------------------
// 4.12: the Tax slabs screen — each category's ladder edited as a whole
// ---------------------------------------------------------------------------

/** One band: where it ends (null: "and above") and its rate; it starts where the band before ends. */
export interface TaxLadderRow {
  upTo: number | null;
  ratePercent: number;
  fixedDeduction: number;
}

export const TAX_CATEGORY_LABEL: Record<TaxCategory, { en: string; hint: string }> = {
  "Normal Single": { en: "Individual", hint: "Single, widowed and anyone without a category of their own" },
  Married: { en: "Couple", hint: "Married, assessed as a couple (Income Tax Act, Schedule 1)" },
  Handicapped: { en: "Person with disability", hint: "Employees marked as having a disability" },
};

export interface TaxSlabsPage {
  years: { value: string; label: string; closed: boolean; current: boolean }[];
  fiscalYearId: string;
  fiscalYearLabel: string;
  /** Each category's bands for the chosen year (empty: not set — payroll falls back to Individual). */
  ladders: Record<TaxCategory, TaxLadderRow[]>;
  /** The chosen year is closed: its slabs are kept as they were. */
  closed: boolean;
  /** The chosen year has pay runs: a change applies to the months still to be paid. */
  hasRuns: boolean;
  canEdit: boolean;
  /** The women's rebate payroll takes off the tax (Rules & controls), for the calculator. */
  womenRebatePercent: number;
}
