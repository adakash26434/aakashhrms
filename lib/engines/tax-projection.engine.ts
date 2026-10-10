import Decimal from "decimal.js";

// Tax projection (4.8 / F5): the monthly TDS of months 1–11 of the fiscal year is the
// tax still to be collected on the projected annual taxable income, spread over the
// months that remain, so a bonus, arrears or an increase in one month is smoothed
// instead of being annualised from that month alone. Pure: the slab maths comes in
// as `taxOn`, nothing here touches the database.
//
//   projected annual taxable = Σ taxable income of the months already paid
//                              + this month's regular (cap-applied) taxable income × months remaining
//                              + what this month pays once (arrears, taxable reimbursements, leave salary)
//   tax to collect           = tax(projected annual taxable) − TDS already deducted
//   TDS this month           = tax to collect ÷ months remaining (this month included)

export interface PastMonth {
  /** Monthly taxable income of a paid month (after retirement / insurance deductions). */
  taxableIncome: string | number;
  /** TDS deducted in that month. */
  tds: string | number;
  /** Months this entry stands for (default 1): an opening balance (F15) carries several. */
  months?: number;
}

export interface TaxSheetInput {
  /** Earlier months of the same fiscal year (approved or locked payslips). */
  past: readonly PastMonth[];
  /** This month's regular taxable income, cap-applied (annual caps ÷ 12). */
  currentTaxable: Decimal.Value;
  /**
   * Taxable income this month pays once (arrears, taxable reimbursements, leave salary, 4.9): added
   * to the projected year once, never multiplied by the months that remain.
   */
  oneOffTaxable?: Decimal.Value;
  /** Months left including this one, 1..12. */
  monthsRemaining: number;
  /** Progressive slab tax on an annual taxable income. */
  taxOn: (annualTaxable: Decimal) => Decimal;
}

export interface TaxSheet {
  monthsPaid: number;
  monthsRemaining: number;
  ytdTaxable: string;
  ytdTds: string;
  currentTaxable: string;
  /** Paid once this month (absent on sheets stored before 4.9). */
  oneOffTaxable?: string;
  projectedAnnualTaxable: string;
  annualTax: string;
  taxToCollect: string;
  tdsThisMonth: string;
}

const money = (v: Decimal) => v.toFixed(2);

export function buildTaxSheet(i: TaxSheetInput): TaxSheet {
  const remaining = Math.min(12, Math.max(1, Math.floor(i.monthsRemaining || 1)));
  const ytdTaxable = i.past.reduce((s, p) => s.plus(p.taxableIncome || 0), new Decimal(0));
  const ytdTds = i.past.reduce((s, p) => s.plus(p.tds || 0), new Decimal(0));
  const current = Decimal.max(0, new Decimal(i.currentTaxable || 0));
  const oneOff = Decimal.max(0, new Decimal(i.oneOffTaxable || 0));
  const projected = ytdTaxable.plus(current.times(remaining)).plus(oneOff);
  const annualTax = i.taxOn(projected);
  const toCollect = Decimal.max(0, annualTax.minus(ytdTds));
  const tds = toCollect.dividedBy(remaining).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return {
    monthsPaid: i.past.reduce((n, p) => n + (p.months ?? 1), 0),
    monthsRemaining: remaining,
    ytdTaxable: money(ytdTaxable),
    ytdTds: money(ytdTds),
    currentTaxable: money(current),
    oneOffTaxable: money(oneOff),
    projectedAnnualTaxable: money(projected),
    annualTax: money(annualTax),
    taxToCollect: money(toCollect),
    tdsThisMonth: tds.toString(),
  };
}

/** Months left in the fiscal year including this one, from the fiscal-month index (Shrawan = 1 … Ashadh = 12). */
export function monthsRemainingFrom(fiscalMonthIndex: number): number {
  return Math.min(12, Math.max(1, 12 - Math.floor(fiscalMonthIndex) + 1));
}
