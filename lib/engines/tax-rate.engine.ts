/**
 * Tax Rate engine — pure domain logic for slab-based TDS configuration.
 *
 * This module is **framework-agnostic** by design:
 *   - No React imports
 *   - No Next.js imports
 *   - No Drizzle / database imports
 *
 * Everything here is a pure function of its inputs. The same engine
 * is used by:
 *   1. The Tax Rate Setup UI (form validation, pre-fill math)
 *   2. The Payroll Engine (annual TDS computation, year-end
 *      reconciliation) — that's a downstream module, not us
 *   3. Unit tests (run with Vitest, no DOM needed)
 *
 * The rules implemented here come from the architecture doc section
 * 6.3 (Nepal TDS logic) and section 4.2 (tax_rate_slabs schema).
 */

import type {
  TaxCategory,
  TaxSlab,
  TaxSlabFormData,
} from "@/lib/types/tax-rate";
import { TAX_CATEGORIES } from "@/lib/types/tax-rate";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Per-field error messages. All optional so a fully valid form
 * produces an empty object.
 */
export interface SlabValidationErrors {
  amountFrom?: string;
  amountTo?: string;
  ratePercent?: string;
  fixedDeduction?: string;
  /** Cross-field rule (e.g. "slab 1 fixed deduction must be 0"). */
  crossField?: string;
  /**
   * Ladder-level rule (e.g. "amountFrom must be previous.amountTo + 1").
   * Set only when validating a slab in the context of its ladder.
   */
  ladder?: string;
}

/**
 * Validate a single slab payload in isolation. Cross-ladder rules
 * (e.g. "amountFrom must chain from previous slab") are NOT checked
 * here — they live in `validateSlabInLadder`.
 */
export function validateSlab(values: TaxSlabFormData): SlabValidationErrors {
  const errors: SlabValidationErrors = {};

  // amountFrom: must be a non-negative integer.
  if (!Number.isFinite(values.amountFrom) || values.amountFrom < 0) {
    errors.amountFrom = "Amount From must be 0 or greater.";
  } else if (!Number.isInteger(values.amountFrom)) {
    errors.amountFrom = "Amount From must be a whole number (no decimals).";
  }

  // amountTo: required unless open-ended; must be > amountFrom.
  if (values.amountTo !== null) {
    if (!Number.isFinite(values.amountTo)) {
      errors.amountTo =
        "Amount To is required, or tick ‘Open-ended (Above)’.";
    } else if (!Number.isInteger(values.amountTo)) {
      errors.amountTo = "Amount To must be a whole number (no decimals).";
    } else if (values.amountTo <= values.amountFrom) {
      errors.amountTo = "Amount To must be greater than Amount From.";
    }
  }

  // ratePercent: 0..100 inclusive.
  if (!Number.isFinite(values.ratePercent)) {
    errors.ratePercent = "Tax rate is required.";
  } else if (values.ratePercent < 0 || values.ratePercent > 100) {
    errors.ratePercent = "Tax rate must be between 0 and 100.";
  }

  // fixedDeduction: ≥ 0.
  if (
    !Number.isFinite(values.fixedDeduction) ||
    values.fixedDeduction < 0
  ) {
    errors.fixedDeduction = "Fixed deduction must be 0 or greater.";
  } else if (!Number.isInteger(values.fixedDeduction)) {
    errors.fixedDeduction = "Fixed deduction must be a whole number.";
  }

  return errors;
}

export interface SlabInLadderContext {
  /** The slab being validated. */
  candidate: TaxSlabFormData;
  /**
   * The previous slab in the same category + FY, or null if this is
   * the first slab of the ladder.
   */
  previous: TaxSlab | null;
  /**
   * Whether the candidate is being created (false) or is editing an
   * existing slab (true). In edit mode, the "previous" for chaining
   * purposes is the slab immediately above the one being edited —
   * computed by the caller and passed in `previous`.
   */
}

/**
 * Validate a slab in the context of its ladder.
 *
 * In addition to the per-field rules in `validateSlab`, this enforces:
 *   - Slab 1's `amountFrom` must be 0.
 *   - Slab 1's `fixedDeduction` must be 0.
 *   - Subsequent slabs' `amountFrom` must equal `previous.amountTo + 1`.
 *
 * Returns an empty object when valid.
 */
export function validateSlabInLadder(
  ctx: SlabInLadderContext,
): SlabValidationErrors {
  const errors = validateSlab(ctx.candidate);
  const isFirst = ctx.previous === null;

  if (isFirst) {
    if (ctx.candidate.amountFrom !== 0) {
      errors.amountFrom =
        "The first slab of a ladder must start at 0.";
    }
    if (ctx.candidate.fixedDeduction !== 0) {
      errors.crossField =
        "The first slab's fixed deduction is always 0 (set by the tax ladder).";
    }
  } else {
    const prev = ctx.previous!;
    const expectedFrom =
      prev.amountTo === null ? prev.amountFrom : prev.amountTo + 1;
    if (ctx.candidate.amountFrom !== expectedFrom) {
      errors.ladder =
        prev.amountTo === null
          ? `Cannot add: the previous slab is open-ended. Edit it first to close it.`
          : `Amount From must be ${expectedFrom.toLocaleString("en-IN")} (one more than the previous slab's Amount To).`;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Pre-fill helpers
// ---------------------------------------------------------------------------

/**
 * Compute the initial form values for a NEW slab that is being
 * appended to the end of an existing ladder. The returned
 * `amountFrom` is `previous.amountTo + 1`. If `previous` is null,
 * the first-slab defaults (from=0, openEnded=true) are returned.
 *
 * `ratePercent` and `amountTo` are left for the user to fill in
 * (or defaulted to the open-ended convention).
 */
export function buildNextSlabDefaults(
  previous: TaxSlab | null,
): Pick<TaxSlabFormData, "amountFrom" | "amountTo" | "ratePercent" | "fixedDeduction"> {
  if (previous === null) {
    return {
      amountFrom: 0,
      amountTo: null,
      ratePercent: 0,
      fixedDeduction: 0,
    };
  }
  if (previous.amountTo === null) {
    // Previous is the open-ended top slab. This is a state that
    // shouldn't be reachable through the UI (we always replace
    // the top slab, never add past it), but defensively return the
    // same `amountFrom` so the caller can show a useful error.
    return {
      amountFrom: previous.amountFrom,
      amountTo: null,
      ratePercent: 0,
      fixedDeduction: 0,
    };
  }
  return {
    amountFrom: previous.amountTo + 1,
    amountTo: null, // new top bracket defaults to open-ended
    ratePercent: 0,
    fixedDeduction: 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregation helpers (used by the KPI cards)
// ---------------------------------------------------------------------------

/**
 * Whether a given (fiscalYearId, category) pair has any slabs.
 * Drives the "configured" indicator on the tab bar and the
 * "Categories Configured" KPI card.
 */
export function isCategoryConfigured(args: {
  slabs: TaxSlab[];
  fiscalYearId: string;
  category: TaxCategory;
}): boolean {
  return args.slabs.some(
    (s) => s.fiscalYearId === args.fiscalYearId && s.category === args.category,
  );
}

/**
 * Return the number of distinct categories that have ≥1 slab for
 * the given fiscal year. Result is in the range 0..TAX_CATEGORIES.length.
 */
export function countConfiguredCategories(args: {
  slabs: TaxSlab[];
  fiscalYearId: string;
}): number {
  return TAX_CATEGORIES.filter((c) =>
    isCategoryConfigured({ ...args, category: c }),
  ).length;
}

/**
 * Highest marginal rate across all slabs for the given FY, in
 * percent. Returns 0 when there are no slabs.
 */
export function highestRateForFY(args: {
  slabs: TaxSlab[];
  fiscalYearId: string;
}): number {
  let max = 0;
  for (const s of args.slabs) {
    if (s.fiscalYearId === args.fiscalYearId && s.ratePercent > max) {
      max = s.ratePercent;
    }
  }
  return max;
}
