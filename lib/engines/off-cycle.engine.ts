import Decimal from "decimal.js";
import { MissingStatutoryHeadError } from "@/lib/engines/payroll.engine";
import type { PayrollCalculationResult } from "@/lib/types/payroll";

// Pay run types (4.8 / F6). A REGULAR run is the monthly salary. An off-cycle run pays one
// thing on its own, in the same pay month, without touching the regular salary:
//   FESTIVAL — the festival allowance (Labour Act 2074 §37: one month's basic remuneration a
//              year, in proportion for service under a year), e.g. before Dashain;
//   ARREARS  — back pay for back-dated salary revisions (F7) without waiting for next month.
// Off-cycle slips carry no basic, SSF, PF, CIT, loan, attendance or feed lines. Their TDS is
// the extra annual tax the payment causes (marginal method): tax(projected year + payment) −
// tax(projected year), withheld at once, so the regular months' TDS is not disturbed. Every
// slip of every type feeds the year's tax history (F5 projection, year-end, certificates).

export { RUN_TYPES, RUN_TYPE_LABEL, asRunType, isOffCycle, type RunType } from "@/lib/constants/run-types";

// ── Festival allowance proration ────────────────────────────────────────────

/** Whole months of service from the joining date to `onAd` (both YYYY-MM-DD), never negative. */
export function completedServiceMonths(joiningAd: string, onAd: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(joiningAd);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(onAd);
  if (!a || !b) return 0;
  let months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
  if (Number(b[3]) < Number(a[3])) months -= 1;
  return Math.max(0, months);
}

/**
 * Share of a year's festival allowance (Labour Act 2074 §37): the whole of it after a year of
 * service, otherwise completed months ÷ 12.
 */
export function festivalShare(joiningAd: string, onAd: string): Decimal {
  return Decimal.min(1, new Decimal(Math.min(12, completedServiceMonths(joiningAd, onAd))).dividedBy(12));
}

// ── Marginal tax ────────────────────────────────────────────────────────────

/**
 * The annual taxable income projected before this payment: what the year has paid so far plus
 * the regular monthly taxable income for the months still to be paid.
 */
export function projectedBefore(i: { ytdTaxable: Decimal.Value; regularMonthlyTaxable: Decimal.Value; monthsAhead: number }): Decimal {
  return new Decimal(i.ytdTaxable || 0).plus(new Decimal(i.regularMonthlyTaxable || 0).times(Math.max(0, Math.floor(i.monthsAhead))));
}

/** Tax a one-off payment causes: tax(base + extra) − tax(base), whole rupees, never negative. */
export function marginalTax(base: Decimal.Value, extra: Decimal.Value, taxOn: (annual: Decimal) => Decimal): Decimal {
  const b = Decimal.max(0, new Decimal(base || 0));
  const e = Decimal.max(0, new Decimal(extra || 0));
  if (e.lte(0)) return new Decimal(0);
  return Decimal.max(0, taxOn(b.plus(e)).minus(taxOn(b))).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/** How an off-cycle slip's TDS was worked out (kept on the slip; the statutory split reads `marginalBase`). */
export interface MarginalTaxSheet {
  kind: "marginal";
  /** Projected annual taxable income before this payment. */
  marginalBase: string;
  /** This payment's taxable amount. */
  extra: string;
  taxWithout: string;
  taxWith: string;
  tds: string;
}

export const isMarginalSheet = (v: unknown): v is MarginalTaxSheet =>
  !!v && typeof v === "object" && (v as { kind?: unknown }).kind === "marginal" && typeof (v as { marginalBase?: unknown }).marginalBase === "string";

// ── Off-cycle payslip ───────────────────────────────────────────────────────

export interface OffCycleLine {
  payHeadId: string;
  payHeadName: string;
  amount: Decimal.Value;
  taxable: boolean;
}

/**
 * An off-cycle payslip: the lines, and the TDS on them — flat 15% of the gross for the contract
 * category (as the regular engine does), none for trainees and volunteers, otherwise the
 * marginal tax on the projected year.
 */
export function calculateOffCycleSlip(args: {
  category: string;
  lines: readonly OffCycleLine[];
  base: Decimal.Value;
  taxOn: (annual: Decimal) => Decimal;
  tdsHead: { id: string; name: string } | null;
}): PayrollCalculationResult & { marginal: MarginalTaxSheet | null } {
  const lines = args.lines
    .map((l) => ({ ...l, value: Decimal.max(0, new Decimal(l.amount || 0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) }))
    .filter((l) => l.value.gt(0));
  const gross = lines.reduce((s, l) => s.plus(l.value), new Decimal(0));
  const taxable = lines.filter((l) => l.taxable).reduce((s, l) => s.plus(l.value), new Decimal(0));

  let tds = new Decimal(0);
  let marginal: MarginalTaxSheet | null = null;
  if (args.category === "Contract") {
    tds = gross.times(0.15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  } else if (args.category !== "Trainee" && args.category !== "Volunteer") {
    const base = Decimal.max(0, new Decimal(args.base || 0));
    const without = args.taxOn(base);
    const withIt = args.taxOn(base.plus(taxable));
    tds = marginalTax(base, taxable, args.taxOn);
    marginal = { kind: "marginal", marginalBase: base.toFixed(2), extra: taxable.toFixed(2), taxWithout: without.toFixed(2), taxWith: withIt.toFixed(2), tds: tds.toFixed(2) };
  }

  const heads: PayrollCalculationResult["heads"] = lines.map((l) => ({ payHeadId: l.payHeadId, payHeadName: l.payHeadName, headType: "allowance", amount: l.value.toFixed(2), calculatedAmount: l.value.toFixed(2) }));
  if (tds.gt(0)) {
    if (!args.tdsHead) throw new MissingStatutoryHeadError("Tax Deducted at Source (TDS)");
    heads.push({ payHeadId: args.tdsHead.id, payHeadName: args.tdsHead.name, headType: "deduction", amount: "0", calculatedAmount: tds.toString() });
  }
  const zero = "0";
  return {
    basicSalary: zero,
    gradeAmount: zero,
    grossEarnings: gross.toFixed(2),
    totalDeductions: tds.toFixed(2),
    netPayable: gross.minus(tds).toFixed(2),
    taxableIncome: taxable.toFixed(2),
    tdsThisMonth: tds.toString(),
    pfEmployee: zero,
    pfEmployer: zero,
    ssfEmployee: zero,
    ssfEmployer: zero,
    citDeduction: zero,
    loanDeduction: zero,
    absentDeduction: zero,
    otAmount: zero,
    heads,
    marginal,
  };
}
