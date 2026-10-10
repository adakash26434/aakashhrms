import Decimal from "decimal.js";
import { readAmount, type ImportColumn, type RowIssue, type SheetRow } from "@/lib/engines/import.engine";
import type { PastMonth } from "@/lib/engines/tax-projection.engine";
import { BS_MONTHS_EN, BS_MONTHS_NP } from "@/lib/utils/bs-calendar";

// Opening balances (4.8 / F15): what an old system paid an employee in the first months of the
// fiscal year, for a company that starts payroll here mid-year. They count as those months:
// one past entry in the tax projection (F5), one past payslip in the Ashadh reconciliation and
// one line on the annual tax certificate (F9), its social security tax as the old system
// deducted it. A month an opening balance covers is never paid again by a run here. Pure.

export const MAX_OPENING_MONTHS = 11;

/** Amounts are money strings with two decimals (as numeric columns read). */
export interface OpeningAmounts {
  /** Fiscal months covered, from Shrawan (1 = Shrawan only … 11 = up to Jestha). */
  months: number;
  grossEarnings: string;
  /** PF and SSF contributions deducted from the employee. */
  retirement: string;
  cit: string;
  taxableIncome: string;
  /** The 1% social security tax deducted. */
  sst: string;
  /** Income tax deducted besides the social security tax. */
  incomeTax: string;
}

const money = (v: Decimal.Value) => new Decimal(v || 0).toFixed(2);

/** The BS month of a fiscal month (Shrawan = 1 … Ashadh = 12) in the year that starts in BS `fyStartBsYear`. */
export function bsMonthOfFiscal(fyStartBsYear: number, index: number): { year: number; month: number } {
  return { year: index <= 9 ? fyStartBsYear : fyStartBsYear + 1, month: ((index + 2) % 12) + 1 };
}

/** The months an opening balance covers: "Shrawan", "Shrawan–Aswin" (or in Nepali). */
export function coveredMonths(months: number, lang: "en" | "np" = "en"): string {
  const names = lang === "np" ? BS_MONTHS_NP : BS_MONTHS_EN;
  const first = names[bsMonthOfFiscal(0, 1).month];
  return months <= 1 ? first : `${first}–${names[bsMonthOfFiscal(0, Math.min(months, MAX_OPENING_MONTHS)).month]}`;
}

/** Tax the old system deducted: social security tax + income tax. */
export const openingTds = (o: Pick<OpeningAmounts, "sst" | "incomeTax">): string => money(new Decimal(o.sst || 0).plus(o.incomeTax || 0));

/** A run for this fiscal month comes after the months the opening balance covers. */
export const isAfterOpening = (o: Pick<OpeningAmounts, "months">, fiscalMonthIndex: number): boolean => fiscalMonthIndex > o.months;

/** The months covered as one past entry of the tax projection. */
export const openingAsPastMonth = (o: OpeningAmounts): PastMonth => ({ taxableIncome: o.taxableIncome, tds: openingTds(o), months: o.months });

/** The months covered as one past payslip of the Ashadh reconciliation (PF / SSF ride with PF). */
export const openingAsYearEndSlip = (o: OpeningAmounts) => ({ grossEarnings: o.grossEarnings, pfEmployee: o.retirement, citDeduction: o.cit, tdsThisMonth: openingTds(o) });

/**
 * Why a run can't pay a month for these people: an opening balance already covers it (the old
 * system paid it), so paying it here would count the month twice.
 */
export function coveredByOpeningMessage(people: readonly { employeeCode: string; fullName: string }[], monthName: string): string {
  const names = people.slice(0, 5).map((p) => `${p.fullName} (${p.employeeCode})`).join(", ");
  const more = people.length > 5 ? ` and ${people.length - 5} more` : "";
  return `Opening balances already cover ${monthName} for ${names}${more}: the old system paid it. Run payroll from the month after, or change their opening balances under Payroll → Opening balances.`;
}

// ---- import -------------------------------------------------------------------------------

export const OPENING_IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "employeeCode", header: "Employee code", required: true, help: "An employee already in the system." },
  { key: "months", header: "Months paid before", required: true, help: "Months of this fiscal year the old system paid, counted from Shrawan: 3 = Shrawan to Aswin (1 to 11)." },
  {
    key: "grossEarnings",
    header: "Gross earnings",
    required: true,
    help: "Everything paid in those months as on the payslips: salary, allowances and the employer's contributions counted as income.",
  },
  { key: "retirement", header: "PF / SSF deducted", help: "The employee's Provident Fund and SSF contributions deducted (empty: 0)." },
  { key: "cit", header: "CIT deducted", help: "Citizen Investment Trust deducted (empty: 0)." },
  { key: "taxableIncome", header: "Taxable income", help: "As the old system worked it out; empty: gross less PF / SSF and CIT." },
  { key: "sst", header: "Social security tax", help: "The 1% social security tax deducted (empty: 0)." },
  { key: "incomeTax", header: "Income tax", help: "Income tax deducted besides the social security tax (empty: 0)." },
  { key: "note", header: "Note", help: "Optional, e.g. the old system's name." },
];

const header = (key: string) => OPENING_IMPORT_COLUMNS.find((c) => c.key === key)?.header ?? key;

/** One row read; `opening` is null when the row has errors of its own (the employee is looked up later). */
export function readOpeningRow(row: SheetRow): { employeeCode: string; opening: OpeningAmounts | null; note: string; issues: RowIssue[] } {
  const c = row.cells;
  const issues: RowIssue[] = [];
  const err = (key: string, message: string) => issues.push({ column: header(key), message, level: "error" });
  const employeeCode = (c.employeeCode ?? "").trim();
  if (!employeeCode) err("employeeCode", "Required");

  const monthsText = (c.months ?? "").trim();
  const months = Number(monthsText);
  if (!monthsText) err("months", "Required");
  else if (!Number.isInteger(months) || months < 1 || months > MAX_OPENING_MONTHS) err("months", "Use a whole number from 1 to 11 (months from Shrawan)");

  const amount = (key: keyof OpeningAmounts, required = false): Decimal | null => {
    const text = (c[key] ?? "").trim();
    if (!text) {
      if (required) err(key, "Required");
      return required ? null : new Decimal(0);
    }
    const value = readAmount(text);
    if (value === null || value < 0) {
      err(key, `"${text}" is not an amount`);
      return null;
    }
    return new Decimal(value);
  };
  const gross = amount("grossEarnings", true);
  const retirement = amount("retirement");
  const cit = amount("cit");
  const typedTaxable = (c.taxableIncome ?? "").trim() ? amount("taxableIncome") : null;
  const sst = amount("sst");
  const incomeTax = amount("incomeTax");

  let taxable = typedTaxable;
  if (gross && retirement && cit) {
    if (retirement.plus(cit).gt(gross)) err("retirement", "PF / SSF and CIT are more than the gross earnings");
    if (!(c.taxableIncome ?? "").trim()) {
      taxable = Decimal.max(0, gross.minus(retirement).minus(cit));
      issues.push({ column: header("taxableIncome"), message: `Worked out as gross less PF / SSF and CIT (${money(taxable)})`, level: "warning" });
    }
  }
  if (gross && taxable && taxable.gt(gross)) err("taxableIncome", "More than the gross earnings");
  if (gross && sst && incomeTax && sst.plus(incomeTax).gt(gross)) err("incomeTax", "The tax deducted is more than the gross earnings");

  const note = (c.note ?? "").trim().slice(0, 300);
  if (issues.some((i) => i.level === "error") || !gross || !retirement || !cit || !taxable || !sst || !incomeTax) return { employeeCode, opening: null, note, issues };
  return {
    employeeCode,
    opening: { months, grossEarnings: money(gross), retirement: money(retirement), cit: money(cit), taxableIncome: money(taxable), sst: money(sst), incomeTax: money(incomeTax) },
    note,
    issues,
  };
}
