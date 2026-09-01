/**
 * Fiscal Year Utilities — shared constants & helpers.
 *
 * Single source of truth for fiscal-year-related constants used by
 * payroll, attendance, and leave salary modules.
 *
 * Nepal BS Fiscal Year: Shrawan (month 4) → Asar (month 3 of next year)
 * Month indexing: Baisakh = 1, Jestha = 2, Asar = 3, ... Chaitra = 12
 * (1-indexed, as defined in lib/utils/bs-calendar.ts)
 */

/**
 * The BS month number for Ashadh/Asar — the LAST month of the Nepal fiscal year.
 * Used for year-end TDS reconciliation in payroll and leave salary.
 *
 * Baisakh = 1, Jestha = 2, **Asar = 3**, Shrawan = 4, ..., Chaitra = 12
 */
export const ASHADH_MONTH = 3;

/**
 * The BS month number for Shrawan — the FIRST month of the Nepal fiscal year.
 */
export const SHRAWAN_MONTH = 4;

/**
 * Check if the given BS month is Ashadh (Asar), i.e. the year-end month
 * when TDS reconciliation must run.
 */
export function isAshadh(bsMonth: number): boolean {
  return bsMonth === ASHADH_MONTH;
}

/**
 * Returns the fiscal-month index (1–12 in fiscal order) for a given BS calendar month.
 * Shrawan(4)=1, Bhadra(5)=2, ..., Chaitra(12)=9, Baisakh(1)=10, Jestha(2)=11, Asar(3)=12
 */
export function getFiscalMonthIndex(bsMonth: number): number {
  return bsMonth >= SHRAWAN_MONTH ? bsMonth - 3 : bsMonth + 9;
}
