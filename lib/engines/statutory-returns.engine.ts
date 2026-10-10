import Decimal from "decimal.js";
import { plainCsvField } from "@/lib/export/csv";
import { PF_RATE, REVENUE_CODE, SSF_RATE, type RevenueCode } from "@/lib/constants/statutory-returns";
import { monthsRemainingFrom } from "@/lib/engines/tax-projection.engine";
import type { TaxSlabInput } from "@/lib/engines/payroll.engine";

// Statutory deposit files (4.8 / F9). Pure: the service gathers payslips of approved /
// locked runs (and paid final settlements) and this turns them into the monthly eTDS,
// SSF, Provident Fund and CIT schedules, their upload files, and the annual tax
// certificate. Amounts are the ones deducted on the payslips; nothing is recalculated
// except the split of TDS between the two revenue codes, which the payslip does not keep.

const ZERO = new Decimal(0);
const dec = (v: Decimal.Value | null | undefined) => new Decimal(v || 0);
const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

// ── Facts ───────────────────────────────────────────────────────────────────

export interface PayeeFacts {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  pan: string | null;
  ssfNumber: string | null;
  pfNumber: string | null;
  citNumber: string | null;
}

/** One payslip of an approved or locked run, as the statutory files need it. */
export interface SlipFact extends PayeeFacts {
  slipId: string;
  /** Pay period (BS). */
  payYear: number;
  payMonth: number;
  /** Shrawan = 1 … Ashadh = 12. */
  fiscalMonthIndex: number;
  /** BS date the salary was paid (the payslip date, else the last day of the month). */
  paymentDateBs: string;
  basicSalary: string;
  gradeAmount: string;
  grossEarnings: string;
  taxableIncome: string;
  tds: string;
  ssfEmployee: string;
  ssfEmployer: string;
  pfEmployee: string;
  pfEmployer: string;
  cit: string;
  /** Annual taxable income the TDS was projected on (F5 tax sheet); null for older slips. */
  projectedAnnualTaxable: string | null;
  /** The Ashadh slip reconciles the year. */
  isYearEnd: boolean;
  /** Flat-rate TDS (contract category): all of it is remuneration tax. */
  flatRate: boolean;
}

/** A final settlement (F8) paid in the year: its TDS closes the employee's year. */
export interface SettlementFact extends PayeeFacts {
  settlementId: string;
  payYear: number;
  payMonth: number;
  fiscalMonthIndex: number;
  paymentDateBs: string;
  /** Earnings on the statement (salary, leave encashment, gratuity). */
  earnings: string;
  /** The settlement's taxable lines (its tax sheet's current taxable). */
  taxable: string;
  tds: string;
  /** Annual taxable income the final TDS was worked on (its tax sheet). */
  annualTaxable: string | null;
}

// ── TDS split between the two revenue codes ──────────────────────────────────

export interface TaxItem {
  key: string;
  fiscalMonthIndex: number;
  /** Within a month: 0 = payslip, 1 = final settlement (after the payslip). */
  order: number;
  taxable: Decimal.Value;
  tds: Decimal.Value;
  /** Annual taxable income this item's TDS was worked on; null = derive from the year so far. */
  annualTaxable: Decimal.Value | null;
  /** Year-end slip or final settlement: collect everything still due. */
  closing: boolean;
  /** Flat-rate TDS: no social security tax in it. */
  flatRate: boolean;
  /** SSF contributors do not pay the 1% social security tax. */
  ssf: boolean;
}

export interface TaxSplit {
  sst: string;
  remuneration: string;
}

/**
 * The top of the 1% social-security band: the first slab (from 0) when its rate is 1%.
 * `slabs` are the employee's own (payroll.engine `slabsForEmployee`); null = no such band.
 */
export function socialSecurityBand(slabs: readonly TaxSlabInput[]): Decimal | null {
  const first = slabs[0];
  if (!first || !dec(first.amountFrom).eq(0) || !first.amountTo) return null;
  return dec(first.ratePercent).eq(1) ? dec(first.amountTo) : null;
}

/**
 * Splits each item's TDS into the social security tax (11211) and the remuneration tax (11112),
 * cumulatively over one employee's fiscal year, the way the TDS itself is projected (F5): the SST
 * still due on the projected year, less the SST already collected, spread over the months left;
 * a closing item (Ashadh, final settlement) collects all of it. `sstOn(annual)` is the employee's
 * tax on the part of the income inside the 1% band (discounts applied), so the year's SST adds up
 * to what the payroll engine charged on the first slab. SST never exceeds the item's TDS.
 */
export function splitSocialSecurityTax(items: readonly TaxItem[], sstOn: (annualTaxable: Decimal) => Decimal): Map<string, TaxSplit> {
  const out = new Map<string, TaxSplit>();
  const ordered = [...items].sort((a, b) => a.fiscalMonthIndex - b.fiscalMonthIndex || a.order - b.order);
  let sstSoFar = ZERO;
  let taxableSoFar = ZERO;
  for (const item of ordered) {
    const tds = Decimal.max(0, dec(item.tds));
    const taxable = Decimal.max(0, dec(item.taxable));
    let sst = ZERO;
    if (!item.flatRate && !item.ssf && tds.gt(0)) {
      const remaining = item.closing ? 1 : monthsRemainingFrom(item.fiscalMonthIndex);
      const annual = item.annualTaxable !== null ? dec(item.annualTaxable) : taxableSoFar.plus(taxable.times(remaining));
      const due = Decimal.max(0, sstOn(annual).minus(sstSoFar));
      sst = Decimal.min(tds, due.dividedBy(remaining).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
    }
    if (!item.flatRate) taxableSoFar = taxableSoFar.plus(taxable);
    sstSoFar = sstSoFar.plus(sst);
    out.set(item.key, { sst: money(sst), remuneration: money(tds.minus(sst)) });
  }
  return out;
}

export const slipTaxItem = (s: SlipFact, ssf: boolean): TaxItem => ({
  key: s.slipId,
  fiscalMonthIndex: s.fiscalMonthIndex,
  order: 0,
  taxable: s.taxableIncome,
  tds: s.tds,
  annualTaxable: s.isYearEnd ? null : s.projectedAnnualTaxable,
  closing: s.isYearEnd,
  flatRate: s.flatRate,
  ssf,
});

export const settlementTaxItem = (s: SettlementFact, ssf: boolean): TaxItem => ({
  key: s.settlementId,
  fiscalMonthIndex: s.fiscalMonthIndex,
  order: 1,
  taxable: s.taxable,
  tds: s.tds,
  annualTaxable: s.annualTaxable,
  closing: true,
  flatRate: false,
  ssf,
});

// ── Contribution base ───────────────────────────────────────────────────────

/**
 * The base a contribution was worked on: basic + grade or basic only, whichever the deducted
 * amount matches at `rate` (to the paisa); otherwise the amount ÷ rate.
 */
export function contributionBase(basic: Decimal.Value, grade: Decimal.Value, amount: Decimal.Value, rate: number): Decimal {
  const paid = dec(amount);
  if (paid.lte(0)) return ZERO;
  for (const candidate of [dec(basic).plus(dec(grade)), dec(basic)]) {
    if (candidate.gt(0) && candidate.times(rate).toDecimalPlaces(2).minus(paid).abs().lte(0.01)) return candidate;
  }
  return paid.dividedBy(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// ── Monthly schedules ───────────────────────────────────────────────────────

export interface FundRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  /** SSF ID / PF number; null when missing on the employee record. */
  number: string | null;
  base: string;
  employee: string;
  employer: string;
  total: string;
}

export interface FundSchedule {
  rows: FundRow[];
  totals: { base: string; employee: string; employer: string; total: string };
  /** Rows without an SSF ID / PF number: the file cannot be uploaded until they are filled in. */
  missingNumbers: number;
}

const byName = <T extends { employeeName: string; employeeCode: string }>(a: T, b: T) => a.employeeName.localeCompare(b.employeeName) || a.employeeCode.localeCompare(b.employeeCode);

function fundSchedule(slips: readonly SlipFact[], pick: (s: SlipFact) => { employee: string; employer: string; number: string | null }, employeeRate: number): FundSchedule {
  const acc = new Map<string, { facts: SlipFact; number: string | null; base: Decimal; employee: Decimal; employer: Decimal }>();
  for (const s of slips) {
    const p = pick(s);
    const employee = dec(p.employee);
    const employer = dec(p.employer);
    if (employee.lte(0) && employer.lte(0)) continue;
    const row = acc.get(s.employeeId) ?? { facts: s, number: p.number?.trim() || null, base: ZERO, employee: ZERO, employer: ZERO };
    row.base = row.base.plus(contributionBase(s.basicSalary, s.gradeAmount, employee, employeeRate));
    row.employee = row.employee.plus(employee);
    row.employer = row.employer.plus(employer);
    acc.set(s.employeeId, row);
  }
  const rows: FundRow[] = [...acc.values()]
    .map((r) => ({
      employeeId: r.facts.employeeId,
      employeeCode: r.facts.employeeCode,
      employeeName: r.facts.employeeName,
      number: r.number,
      base: money(r.base),
      employee: money(r.employee),
      employer: money(r.employer),
      total: money(r.employee.plus(r.employer)),
    }))
    .sort(byName);
  const sum = (f: (r: FundRow) => string) => money(rows.reduce((s, r) => s.plus(f(r)), ZERO));
  return {
    rows,
    totals: { base: sum((r) => r.base), employee: sum((r) => r.employee), employer: sum((r) => r.employer), total: sum((r) => r.total) },
    missingNumbers: rows.filter((r) => !r.number).length,
  };
}

/** SSF contribution schedule: 11% employee + 20% employer on the contribution base. */
export const ssfSchedule = (slips: readonly SlipFact[]): FundSchedule =>
  fundSchedule(slips, (s) => ({ employee: s.ssfEmployee, employer: s.ssfEmployer, number: s.ssfNumber }), SSF_RATE.employee);

/** Provident Fund statement: 10% employee + 10% employer on basic. */
export const pfSchedule = (slips: readonly SlipFact[]): FundSchedule =>
  fundSchedule(slips, (s) => ({ employee: s.pfEmployee, employer: s.pfEmployer, number: s.pfNumber }), PF_RATE.employee);

export interface CitRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  number: string | null;
  amount: string;
}

export interface CitSchedule {
  rows: CitRow[];
  total: string;
  missingNumbers: number;
}

/** CIT statement: the month's CIT deducted per employee. */
export function citSchedule(slips: readonly SlipFact[]): CitSchedule {
  const acc = new Map<string, { facts: SlipFact; amount: Decimal }>();
  for (const s of slips) {
    const amount = dec(s.cit);
    if (amount.lte(0)) continue;
    const row = acc.get(s.employeeId) ?? { facts: s, amount: ZERO };
    row.amount = row.amount.plus(amount);
    acc.set(s.employeeId, row);
  }
  const rows = [...acc.values()]
    .map((r) => ({ employeeId: r.facts.employeeId, employeeCode: r.facts.employeeCode, employeeName: r.facts.employeeName, number: r.facts.citNumber?.trim() || null, amount: money(r.amount) }))
    .sort(byName);
  return { rows, total: money(rows.reduce((s, r) => s.plus(r.amount), ZERO)), missingNumbers: rows.filter((r) => !r.number).length };
}

// ── TDS (eTDS) ──────────────────────────────────────────────────────────────

export interface TdsRow {
  key: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  pan: string | null;
  source: "payroll" | "settlement";
  paymentDateBs: string;
  /** Gross payment (payslip gross earnings / settlement earnings). */
  gross: string;
  taxable: string;
  sst: string;
  remuneration: string;
  tds: string;
}

export function tdsRowFromSlip(s: SlipFact, split: TaxSplit | undefined): TdsRow {
  return {
    key: s.slipId,
    employeeId: s.employeeId,
    employeeCode: s.employeeCode,
    employeeName: s.employeeName,
    pan: s.pan?.trim() || null,
    source: "payroll",
    paymentDateBs: s.paymentDateBs,
    gross: money(dec(s.grossEarnings)),
    taxable: money(dec(s.taxableIncome)),
    sst: split?.sst ?? "0.00",
    remuneration: split?.remuneration ?? money(dec(s.tds)),
    tds: money(dec(s.tds)),
  };
}

export function tdsRowFromSettlement(s: SettlementFact, split: TaxSplit | undefined): TdsRow {
  return {
    key: s.settlementId,
    employeeId: s.employeeId,
    employeeCode: s.employeeCode,
    employeeName: s.employeeName,
    pan: s.pan?.trim() || null,
    source: "settlement",
    paymentDateBs: s.paymentDateBs,
    gross: money(dec(s.earnings)),
    taxable: money(dec(s.taxable)),
    sst: split?.sst ?? "0.00",
    remuneration: split?.remuneration ?? money(dec(s.tds)),
    tds: money(dec(s.tds)),
  };
}

export interface EtdsLine {
  sn: number;
  pan: string;
  employeeName: string;
  employeeCode: string;
  revenueCode: RevenueCode;
  paymentDateBs: string;
  payment: string;
  tds: string;
}

/** One eTDS transaction per employee per revenue code with tax in it, social security tax first. */
export function etdsLines(rows: readonly TdsRow[]): EtdsLine[] {
  const lines: Omit<EtdsLine, "sn">[] = [];
  for (const r of [...rows].sort(byName)) {
    for (const [code, amount] of [
      [REVENUE_CODE.socialSecurityTax, r.sst],
      [REVENUE_CODE.remunerationTax, r.remuneration],
    ] as const) {
      if (dec(amount).lte(0)) continue;
      lines.push({ pan: r.pan ?? "", employeeName: r.employeeName, employeeCode: r.employeeCode, revenueCode: code, paymentDateBs: r.paymentDateBs, payment: r.gross, tds: amount });
    }
  }
  return lines.map((l, i) => ({ sn: i + 1, ...l }));
}

export interface VoucherLine {
  revenueCode: RevenueCode;
  transactions: number;
  tds: string;
}

/** What to deposit under each revenue code (the eTDS voucher form). */
export function voucherSummary(lines: readonly EtdsLine[]): VoucherLine[] {
  return [REVENUE_CODE.socialSecurityTax, REVENUE_CODE.remunerationTax]
    .map((code) => {
      const mine = lines.filter((l) => l.revenueCode === code);
      return { revenueCode: code, transactions: mine.length, tds: money(mine.reduce((s, l) => s.plus(l.tds), ZERO)) };
    })
    .filter((v) => v.transactions > 0);
}

// ── Upload files ────────────────────────────────────────────────────────────

const csv = (header: string[], rows: (string | number | null)[][]) => [header.join(","), ...rows.map((r) => r.map((v) => plainCsvField(v)).join(","))].join("\r\n") + "\r\n";

export function etdsCsv(lines: readonly EtdsLine[]): string {
  return csv(
    ["SN", "PAN", "Name", "RevenueCode", "PaymentDateBS", "PaymentAmount", "TDSAmount"],
    lines.map((l) => [l.sn, l.pan, l.employeeName, l.revenueCode, l.paymentDateBs, l.payment, l.tds]),
  );
}

export function ssfCsv(schedule: FundSchedule): string {
  return csv(
    ["SN", "SSID", "Name", "EmployeeCode", "ContributionBase", "Employee11", "Employer20", "Total31"],
    schedule.rows.map((r, i) => [i + 1, r.number ?? "", r.employeeName, r.employeeCode, r.base, r.employee, r.employer, r.total]),
  );
}

export function pfCsv(schedule: FundSchedule): string {
  return csv(
    ["SN", "PFNumber", "Name", "EmployeeCode", "Basic", "Employee10", "Employer10", "Total"],
    schedule.rows.map((r, i) => [i + 1, r.number ?? "", r.employeeName, r.employeeCode, r.base, r.employee, r.employer, r.total]),
  );
}

export function citCsv(schedule: CitSchedule): string {
  return csv(
    ["SN", "CITNumber", "Name", "EmployeeCode", "Amount"],
    schedule.rows.map((r, i) => [i + 1, r.number ?? "", r.employeeName, r.employeeCode, r.amount]),
  );
}

// ── Annual tax certificate ──────────────────────────────────────────────────

export interface CertificateLine {
  /** BS month, e.g. "Shrawan 2083", or "Final settlement". */
  label: string;
  labelNp: string;
  source: "payroll" | "settlement";
  paymentDateBs: string;
  gross: string;
  /** Employee's SSF / PF / CIT contributions deducted. */
  retirement: string;
  taxable: string;
  sst: string;
  remuneration: string;
  tds: string;
}

export interface CertificateTotals {
  gross: string;
  retirement: string;
  taxable: string;
  sst: string;
  remuneration: string;
  tds: string;
}

export function certificateTotals(lines: readonly CertificateLine[]): CertificateTotals {
  const sum = (f: (l: CertificateLine) => string) => money(lines.reduce((s, l) => s.plus(f(l)), ZERO));
  return {
    gross: sum((l) => l.gross),
    retirement: sum((l) => l.retirement),
    taxable: sum((l) => l.taxable),
    sst: sum((l) => l.sst),
    remuneration: sum((l) => l.remuneration),
    tds: sum((l) => l.tds),
  };
}

/** The employee's own retirement contributions on a payslip (they reduce taxable income). */
export const slipRetirement = (s: SlipFact): string => money(dec(s.ssfEmployee).plus(dec(s.pfEmployee)).plus(dec(s.cit)));
