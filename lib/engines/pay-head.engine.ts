/**
 * Pay Head engine — pure domain logic for validating, aggregating,
 * and querying pay heads.
 *
 * This module is **framework-agnostic** by design:
 *   - No React imports
 *   - No Next.js imports
 *   - No Drizzle / database imports
 *
 * Everything here is a pure function of its inputs. The same
 * engine is used by:
 *   1. The Pay Head Setup UI (form validation, KPI card math)
 *   2. The Service layer (re-validates before persisting)
 *   3. Unit tests (Vitest, no DOM)
 *
 * The rules implemented here come from the architecture doc
 * section 4.2 (`pay_heads` schema), section 6.3 (statutory
 * deduction logic, SSF/PF redirect), and section 12 (Nepal
 * statutory specifics).
 */

import type {
  PayHead,
  PayHeadFormData,
  PayHeadType,
  StatutoryFlag,
} from "@/lib/types/pay-head";
import { STATUTORY_FLAGS, STATUTORY_KPI_FLAGS } from "@/lib/types/pay-head";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface PayHeadValidationErrors {
  name?: string;
  type?: string;
  effectOnTax?: string;
  calcBasis?: string;
  calcParameter?: string;
  calcPercent?: string;
  applicableDepartmentIds?: string;
  applicableDesignationIds?: string;
  /** Cross-field: a flag contradicts the chosen type. */
  flagAlignment?: string;
  /** Cross-field: TDS/PF/SSF/CIT flag with wrong effectOnTax. */
  taxEffect?: string;
}

// ----- Per-field helpers ---------------------------------------------------

const NAME_MIN = 1;
const NAME_MAX = 60;

function isValidName(n: string): boolean {
  return n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;
}

function isValidPercent(p: number): boolean {
  return Number.isFinite(p) && p >= 0 && p <= 100;
}

// ----- Uniqueness helpers (public) -----------------------------------------

/**
 * Case-insensitive name uniqueness. Used at create and update
 * time. Pass `excludeId` when updating so the head's own current
 * name doesn't collide with itself.
 */
export function isNameUnique(args: {
  candidate: string;
  existing: PayHead[];
  excludeId?: string;
}): boolean {
  const target = args.candidate.trim().toLowerCase();
  return !args.existing.some(
    (h) =>
      h.id !== args.excludeId && h.name.trim().toLowerCase() === target,
  );
}

// ----- Main validator ------------------------------------------------------

export interface ValidatePayHeadArgs {
  data: PayHeadFormData;
  existing: PayHead[];
  excludeId?: string;
  /** Valid department IDs (used to validate the chosen list). */
  validDepartmentIds: string[];
  /** Valid designation IDs. */
  validDesignationIds: string[];
}

/**
 * Validate a pay head form payload. Combines per-field rules
 * with cross-field rules:
 *
 *   1. Name required, 1–60 chars, unique.
 *   2. Type must be one of the two enum values.
 *   3. Calc basis required.
 *   4. Calculation % required when calcBasis !== "None", in 0–100.
 *   5. At least one valid department and at least one valid
 *      designation (empty list = "All", which is the default
 *      when the user hasn't selected anything but the form
 *      should require an explicit "all" intent — see note below).
 *   6. Flag/type alignment: a TDS / PF / SSF / CIT / Absent flag
 *      forces `type = "deduction"`. A Festival / OT / Leave /
 *      Remote flag forces `type = "allowance"`. Mixing both
 *      families is rejected.
 *   7. Tax-effect: TDS / PF / SSF / CIT flag implies
 *      `effectOnTax` semantics:
 *        - TDS: `effectOnTax` should be true (TDS reduces tax).
 *          Actually, per design, TDS head has `effectOnTax: false`
 *          because it's a deduction that doesn't itself form part
 *          of taxable income. We allow either but warn if the
 *          deduction heads (CIT) have effectOnTax: false (CIT
 *          reduces taxable income).
 *
 * **Applicability note**: the form's checkbox grid always
 * returns a non-empty array (we never persist an empty list —
 * the modal pre-checks all options). The engine therefore
 * allows empty arrays as a defensive case but does not flag
 * them as invalid; the UI is responsible for visualising
 * "all selected" as the "All Depts / All Positions" badge.
 */
export function validatePayHead(
  args: ValidatePayHeadArgs,
): PayHeadValidationErrors {
  const { data, existing, excludeId, validDepartmentIds, validDesignationIds } =
    args;
  const errors: PayHeadValidationErrors = {};

  // 1. Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Pay Head Name is required.";
  } else if (!isValidName(data.name)) {
    errors.name = `Pay Head Name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  } else if (
    !isNameUnique({ candidate: data.name, existing, excludeId })
  ) {
    errors.name = `A pay head named "${data.name.trim()}" already exists.`;
  }

  // 2. Type — just verify it parses as one of the two values
  if (data.type !== "allowance" && data.type !== "deduction") {
    errors.type = "Type must be Allowance or Deduction.";
  }

  // 3. Calc basis
  if (
    data.calcBasis !== "BasicSalary" &&
    data.calcBasis !== "BasicPlusGrade" &&
    data.calcBasis !== "None"
  ) {
    errors.calcBasis = "Calculation basis is required.";
  }

  // 4. Calc percent (required unless calcBasis is None)
  if (data.calcBasis !== "None") {
    if (!isValidPercent(data.calcPercent)) {
      errors.calcPercent = "Calculation % must be between 0 and 100.";
    }
  }

  // 5a. Departments — when non-empty, every id must be valid
  if (data.applicableDepartmentIds.length > 0) {
    const invalid = data.applicableDepartmentIds.filter(
      (id) => !validDepartmentIds.includes(id),
    );
    if (invalid.length > 0) {
      errors.applicableDepartmentIds =
        "One or more selected departments are no longer available.";
    }
  }

  // 5b. Designations
  if (data.applicableDesignationIds.length > 0) {
    const invalid = data.applicableDesignationIds.filter(
      (id) => !validDesignationIds.includes(id),
    );
    if (invalid.length > 0) {
      errors.applicableDesignationIds =
        "One or more selected positions are no longer available.";
    }
  }

  // 6. Flag-type alignment
  const flagAlignError = validateFlagTypeAlignment(data.flags, data.type);
  if (flagAlignError) {
    errors.flagAlignment = flagAlignError;
  }

  // 7. Tax-effect sanity (only when type is deduction and one of
  //    the "reduces taxable income" flags is set, effectOnTax
  //    should be true)
  if (data.type === "deduction" && data.flags.isCitHead === true) {
    if (data.effectOnTax !== true) {
      errors.taxEffect =
        "CIT reduces taxable income — set Effect on Tax to Yes.";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Flag-type alignment
// ---------------------------------------------------------------------------

/**
 * Which flags require which type. Drawn from the architecture
 * doc section 4.2 + section 12.2 (CIT/PF/SSF are deductions;
 * Festival/OT/Leave/Remote are allowances).
 */
const DEDUCTION_FLAGS: StatutoryFlag[] = [
  "isTdsHead",
  "isPfHead",
  "isSsfHead",
  "isCitHead",
  "isAbsentDeduct",
];

const ALLOWANCE_FLAGS: StatutoryFlag[] = [
  "isFestivalAllowance",
  "isOtHead",
  "isLeaveHead",
  "isRemoteAllowance",
];

/**
 * Returns an error message if any active flag contradicts the
 * chosen type, or if the head has both allowance-typed and
 * deduction-typed flags set. Returns `null` when the flag/type
 * combination is consistent.
 */
export function validateFlagTypeAlignment(
  flags: Partial<Record<StatutoryFlag, boolean>>,
  type: PayHeadType,
): string | null {
  const hasDeductionFlags = DEDUCTION_FLAGS.some((f) => flags[f] === true);
  const hasAllowanceFlags = ALLOWANCE_FLAGS.some((f) => flags[f] === true);

  // Mixing both families on a single head is not allowed.
  if (hasDeductionFlags && hasAllowanceFlags) {
    return "Cannot mix allowance-typed flags (Festival / OT / Leave / Remote) with deduction-typed flags (TDS / PF / SSF / CIT / Absent). Split into two heads.";
  }

  if (type === "allowance" && hasDeductionFlags) {
    const which = DEDUCTION_FLAGS.filter((f) => flags[f] === true);
    return `Flag${
      which.length > 1 ? "s" : ""
    } ${which.join(", ")} require type = Deduction.`;
  }

  if (type === "deduction" && hasAllowanceFlags) {
    const which = ALLOWANCE_FLAGS.filter((f) => flags[f] === true);
    return `Flag${
      which.length > 1 ? "s" : ""
    } ${which.join(", ")} require type = Allowance.`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Aggregations (used by KPI cards + search/filter)
// ---------------------------------------------------------------------------

export interface PayHeadCounts {
  total: number;
  allowances: number;
  deductions: number;
  /** Heads with any of the 4 primary statutory flags (PF/SSF/CIT/TDS). */
  statutory: number;
}

export function countByType(heads: PayHead[]): PayHeadCounts {
  let allowances = 0;
  let deductions = 0;
  let statutory = 0;
  for (const h of heads) {
    if (h.type === "allowance") allowances++;
    else deductions++;
    if (STATUTORY_KPI_FLAGS.some((f) => h.flags[f] === true)) statutory++;
  }
  return {
    total: heads.length,
    allowances,
    deductions,
    statutory,
  };
}

// ---------------------------------------------------------------------------
// Filter + search helpers
// ---------------------------------------------------------------------------

export interface FilterPayHeadsArgs {
  heads: PayHead[];
  /** "all" returns every head; otherwise filtered by type. */
  typeFilter: "all" | PayHeadType;
  /**
   * Free-text query. Matches name OR code, case-insensitive.
   * Empty string returns every head.
   */
  search?: string;
  /** Optional department id — restricts to heads applicable to it. */
  departmentId?: string;
  /** Optional designation id — restricts to heads applicable to it. */
  designationId?: string;
}

/**
 * Apply the type filter, search query, and (optional) scope
 * filters to a pay-head list. Order is preserved (the caller
 * is expected to pass a pre-sorted list).
 *
 * "Applicable to" semantics: a head with an empty
 * `applicableDepartmentIds` list applies to all departments.
 * A head with a non-empty list applies only to the listed
 * departments. So a head matches `departmentId = "dept-it"`
 * when EITHER the list is empty (all) OR the id is in the list.
 */
export function filterPayHeads(args: FilterPayHeadsArgs): PayHead[] {
  const { heads, typeFilter, search, departmentId, designationId } = args;
  const q = (search ?? "").trim().toLowerCase();

  return heads.filter((h) => {
    if (typeFilter !== "all" && h.type !== typeFilter) return false;
    if (q) {
      const hay = `${h.name} ${h.code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (
      departmentId &&
      h.applicableDepartmentIds.length > 0 &&
      !h.applicableDepartmentIds.includes(departmentId)
    ) {
      return false;
    }
    if (
      designationId &&
      h.applicableDesignationIds.length > 0 &&
      !h.applicableDesignationIds.includes(designationId)
    ) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Generate the next sequential pay head code, e.g. "PH-001",
 * "PH-002", …, "PH-014", "PH-015".
 *
 * Inspects the existing list and returns `PH-` zero-padded to 3
 * digits using the max numeric suffix + 1. Falls back to
 * `PH-001` if no existing heads.
 */
export function nextPayHeadCode(existing: PayHead[]): string {
  let max = 0;
  for (const h of existing) {
    const m = /^PH-(\d+)$/i.exec(h.code);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `PH-${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

/**
 * Normalise a form's `flags` object so every known flag has an
 * explicit `boolean` (defaulting to `false`). Useful for
 * persistence and for consistent rendering of the 9-flag grid.
 */
export function normalizeFlags(
  raw: Partial<Record<StatutoryFlag, boolean>>,
): Record<StatutoryFlag, boolean> {
  const out = {} as Record<StatutoryFlag, boolean>;
  for (const f of STATUTORY_FLAGS) {
    out[f] = raw[f] === true;
  }
  return out;
}
