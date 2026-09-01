import type {
  FiscalYear,
  FiscalYearData,
} from "@/lib/types/fiscal-year";
import {
  adToBSString,
  bsToAD,
  getDaysInBSMonth,
} from "@/lib/utils/bs-calendar";

/**
 * Build a fiscal-year record for a given BS opening year.
 *
 * Nepal's fiscal year runs from Shrawan (month 4) of the opening
 * year to Asar (month 3) of the next year. The end date is the
 * LAST day of Asar — which varies year to year (28–32 days) and is
 * looked up from the BS engine.
 */
function makeFY(args: {
  openingYear: number;
  payslipsGenerated: boolean;
}): FiscalYear {
  const startAD = bsToAD(args.openingYear, 4, 1);
  const endMonthDays = getDaysInBSMonth(args.openingYear + 1, 3);
  const endAD = bsToAD(args.openingYear + 1, 3, endMonthDays);
  const endYearShort = String(args.openingYear + 1).slice(-2).padStart(2, "0");

  return {
    id: `fy-${args.openingYear}-${endYearShort}`,
    label: `FY ${args.openingYear}/${endYearShort}`,
    slug: `fy-${args.openingYear}-${endYearShort}`,
    fromMonth: 4, // Shrawan
    toMonth: 3, // Asar
    startDateAD: startAD,
    endDateAD: endAD,
    startDateBS: adToBSString(startAD),
    endDateBS: adToBSString(endAD),
    status: args.payslipsGenerated ? "Locked" : "Active",
    payslipsGenerated: args.payslipsGenerated,
  };
}

/**
 * The data builder used by the repository on `createFiscalYear`.
 *
 * Given a write input (slug, from/to month, start/end AD date),
 * this function computes all the derived fields (id, label,
 * startDateBS, endDateBS, status) and returns a fully-shaped
 * `FiscalYear`. The "is locked" flag defaults to `false` because
 * a new fiscal year has never had payslips generated.
 */
export function buildFiscalYearFromInput(args: {
  slug: string;
  fromMonth: number;
  toMonth: number;
  startDateAD: Date;
  endDateAD: Date;
  payslipsGenerated: boolean;
}): FiscalYear {
  // Derive the opening year from the AD start date. The legacy
  // `id` and `label` format use this year in BS.
  const openingYear = args.startDateAD.getFullYear();
  // The end year label is openingYear+1 (e.g. FY 2081/82).
  const endYearShort = String(openingYear + 1).slice(-2).padStart(2, "0");
  return {
    id: args.slug || `fy-${openingYear}-${endYearShort}`,
    label: `FY ${openingYear}/${endYearShort}`,
    slug: args.slug,
    fromMonth: args.fromMonth as FiscalYear["fromMonth"],
    toMonth: args.toMonth as FiscalYear["toMonth"],
    startDateAD: args.startDateAD,
    endDateAD: args.endDateAD,
    startDateBS: adToBSString(args.startDateAD),
    endDateBS: adToBSString(args.endDateAD),
    status: args.payslipsGenerated ? "Locked" : "Active",
    payslipsGenerated: args.payslipsGenerated,
  };
}

/**
 * Module-level mutable store. The repository reads from / writes
 * to this array. Pre-populated with three seed years (current
 * active, two locked).
 *
 * **Why mutable, not frozen?** Because the mock repository
 * (the only thing that calls the CRUD functions today) needs to
 * be able to push, splice, and replace items. When the real DB
 * is wired, this in-memory list is replaced by Drizzle queries
 * and the mutability goes away.
 */
export const mockFiscalYearList: FiscalYear[] = [
  makeFY({ openingYear: 2081, payslipsGenerated: false }), // Active
  makeFY({ openingYear: 2080, payslipsGenerated: true }), // Locked
  makeFY({ openingYear: 2079, payslipsGenerated: true }), // Locked
];

/**
 * **Deprecated** snapshot view, kept for any old call site that
 * imported `mockFiscalYearData` directly. New code should go
 * through the service layer.
 *
 * @deprecated Use `fiscalYearService.getFiscalYearData()` instead.
 */
export const mockFiscalYearData: FiscalYearData = {
  fiscalYears: mockFiscalYearList,
};

/**
 * Async data getter used by the server component (`page.tsx`).
 * Kept for backwards-compat. New server-side code should call
 * the service layer.
 *
 * @deprecated Use the service layer.
 */
export async function getFiscalYearData(): Promise<FiscalYearData> {
  return {
    fiscalYears: [...mockFiscalYearList].sort(
      (a, b) => b.startDateAD.getTime() - a.startDateAD.getTime(),
    ),
  };
}
