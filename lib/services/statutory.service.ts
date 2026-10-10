import Decimal from 'decimal.js';
import type { SQL } from 'drizzle-orm';
import * as repo from '@/lib/repositories/statutory.repository';
import * as taxRateRepo from '@/lib/repositories/tax-rate.repository';
import * as systemControlRepo from '@/lib/repositories/system-control.repository';
import { calculateAnnualTaxFromSlabs, slabsForEmployee, type TaxSlabInput } from '@/lib/engines/payroll.engine';
import {
  certificateTotals,
  citCsv,
  citSchedule,
  etdsCsv,
  etdsLines,
  pfCsv,
  pfSchedule,
  settlementTaxItem,
  slipRetirement,
  slipTaxItem,
  socialSecurityBand,
  splitSocialSecurityTax,
  ssfCsv,
  ssfSchedule,
  tdsRowFromSettlement,
  tdsRowFromSlip,
  voucherSummary,
  type CertificateLine,
  type SettlementFact,
  type SlipFact,
  type TaxSplit,
} from '@/lib/engines/statutory-returns.engine';
import { REVENUE_CODE, REVENUE_CODE_LABEL, STATUTORY_FILES, type StatutoryFile } from '@/lib/constants/statutory-returns';
import { STATUTORY_RULES } from '@/lib/constants/statutory-deadlines';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBS, adToBSString, BS_MONTHS_EN, BS_MONTHS_NP, bsToAD, getDaysInBSMonth } from '@/lib/utils/bs-calendar';
import { getFiscalMonthIndex } from '@/lib/utils/fiscal-year.utils';
import { toNepaliNumerals } from '@/lib/utils/date-input-formatter';
import { addDays, nepalDateIso, nepalToday } from '@/lib/utils/nepal-time';
import type { SystemControlData } from '@/lib/types/system-control';
import type { SettlementLine } from '@/lib/engines/settlement.engine';
import type { TaxSheet } from '@/lib/engines/tax-projection.engine';
import type { CertificateListData, CertificateListRow, PayPeriodOption, StatutoryMonthData, TaxCertificateData } from '@/lib/types/statutory';

// Statutory deposit files (4.8 / F9): gathers the payslips of approved / locked runs
// (and paid final settlements) of a fiscal year within the viewer's scope, lets the
// pure engine build the month's eTDS / SSF / PF / CIT schedules and the annual tax
// certificate, and produces the upload files. The TDS split between the two revenue
// codes is cumulative over the year, so a month is always worked out with the months
// before it.

export interface StatutoryCtx {
  userId: string;
  scope: ScopeFilter;
}

const pad = (n: number) => String(n).padStart(2, '0');
const periodValue = (year: number, month: number) => `${year}-${pad(month)}`;
const monthLabel = (year: number, month: number) => `${BS_MONTHS_EN[month] ?? month} ${year}`;
const monthLabelNp = (year: number, month: number) => `${BS_MONTHS_NP[month] ?? month} ${toNepaliNumerals(year)}`;
const bsOfIso = (iso: string) => adToBSString(new Date(`${iso}T00:00:00`));

export function parsePeriod(value: unknown): { year: number; month: number } | null {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

/** BS date `days` after the end of a BS month. */
function dueAfter(year: number, month: number, days: number): string {
  const end = bsToAD(year, month, getDaysInBSMonth(year, month) || 30);
  return adToBSString(addDays(end, days));
}

const ruleDays = (id: 'tds' | 'ssf') => STATUTORY_RULES.find((r) => r.id === id)?.daysAfterMonthEnd ?? (id === 'tds' ? 25 : 15);

// ── Facts → engine inputs ───────────────────────────────────────────────────

function toSlipFact(r: repo.SlipFactRow): SlipFact {
  const sheet = r.taxSheet as Partial<TaxSheet> | null;
  return {
    slipId: r.slipId,
    employeeId: r.employeeId,
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    pan: r.pan,
    ssfNumber: r.ssfNumber,
    pfNumber: r.pfNumber,
    citNumber: r.citNumber,
    payYear: r.payYear,
    payMonth: r.payMonth,
    fiscalMonthIndex: getFiscalMonthIndex(r.payMonth),
    // The salary was paid on the payslip date; without one, the last day of the pay month.
    paymentDateBs: r.payslipDate && /^\d{4}-\d{2}-\d{2}$/.test(r.payslipDate) ? bsOfIso(r.payslipDate) : `${r.payYear}-${pad(r.payMonth)}-${pad(getDaysInBSMonth(r.payYear, r.payMonth) || 30)}`,
    basicSalary: r.basicSalary,
    gradeAmount: r.gradeAmount,
    grossEarnings: r.grossEarnings,
    taxableIncome: r.taxableIncome,
    tds: r.tds,
    ssfEmployee: r.ssfEmployee,
    ssfEmployer: r.ssfEmployer,
    pfEmployee: r.pfEmployee,
    pfEmployer: r.pfEmployer,
    cit: r.cit,
    projectedAnnualTaxable: typeof sheet?.projectedAnnualTaxable === 'string' ? sheet.projectedAnnualTaxable : null,
    isYearEnd: r.isYearEnd,
    // The payroll engine withholds a flat 15% for the contract category (no slabs, so no SST).
    flatRate: r.category === 'Contract',
  };
}

function toSettlementFact(r: repo.SettlementFactRow, fyStartBsYear: number): SettlementFact | null {
  const iso = nepalDateIso(new Date(r.paidAt));
  const bs = adToBS(new Date(`${iso}T00:00:00`));
  const fyOf = bs.month >= 4 ? bs.year : bs.year - 1;
  if (fyOf !== fyStartBsYear) return null;
  const sheet = r.taxSheet as Partial<TaxSheet> | null;
  const tds = (Array.isArray(r.lines) ? (r.lines as SettlementLine[]) : []).find((l) => l.code === 'tds')?.amount ?? '0';
  return {
    settlementId: r.settlementId,
    employeeId: r.employeeId,
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    pan: r.pan,
    ssfNumber: r.ssfNumber,
    pfNumber: r.pfNumber,
    citNumber: r.citNumber,
    payYear: bs.year,
    payMonth: bs.month,
    fiscalMonthIndex: getFiscalMonthIndex(bs.month),
    paymentDateBs: bsOfIso(iso),
    earnings: r.earnings,
    taxable: typeof sheet?.currentTaxable === 'string' ? sheet.currentTaxable : '0',
    tds,
    annualTaxable: typeof sheet?.projectedAnnualTaxable === 'string' ? sheet.projectedAnnualTaxable : null,
  };
}

interface TaxFacts {
  category: string;
  taxStatus: string;
  isDisabled: boolean;
  gender: string;
  joiningDate: string;
}

interface YearBook {
  slips: SlipFact[];
  settlements: SettlementFact[];
  split: Map<string, TaxSplit>;
  /** Employees with an SSF deduction in the year. */
  ssf: Set<string>;
  facts: Map<string, TaxFacts & { taxStatus: string }>;
}

async function taxContext(fiscalYearId: string): Promise<{ slabs: TaxSlabInput[]; control: SystemControlData }> {
  const [slabs, control] = await Promise.all([taxRateRepo.findSlabsByFiscalYear(fiscalYearId), systemControlRepo.findSettings()]);
  return {
    slabs: slabs.map((s) => ({
      id: s.id,
      category: s.category,
      amountFrom: s.amountFrom.toString(),
      amountTo: s.amountTo ? s.amountTo.toString() : null,
      ratePercent: s.ratePercent.toString(),
      fixedDeduction: s.fixedDeduction.toString(),
    })),
    control,
  };
}

/** The year's facts and the TDS split of every payslip and settlement in it, per employee. */
async function yearBook(
  fy: NonNullable<Awaited<ReturnType<typeof repo.fiscalYear>>>,
  filter: { scope?: SQL; employeeId?: string; upToFiscalMonth?: number; extra?: SQL[] },
): Promise<YearBook> {
  const [slipRows, settlementRows, tax] = await Promise.all([
    repo.slipFacts({ fiscalYearId: fy.id, upToFiscalMonth: filter.upToFiscalMonth, employeeId: filter.employeeId, scope: filter.scope, extra: filter.extra }),
    // The portal's visibility rule is for payslips; a final settlement is shown once paid.
    repo.paidSettlements({ fromAd: addDays(new Date(fy.startDateAD), -1), toAd: addDays(new Date(fy.endDateAD), 2), employeeId: filter.employeeId, scope: filter.scope }),
    taxContext(fy.id),
  ]);
  const fyStartBsYear = Number(String(fy.startDateBS).slice(0, 4));
  const slips = slipRows.map(toSlipFact);
  const settlements = settlementRows
    .map((r) => toSettlementFact(r, fyStartBsYear))
    .filter((s): s is SettlementFact => !!s && (!filter.upToFiscalMonth || s.fiscalMonthIndex <= filter.upToFiscalMonth));

  const facts = new Map<string, TaxFacts>();
  for (const r of [...slipRows, ...settlementRows]) facts.set(r.employeeId, { category: r.category, taxStatus: r.taxStatus, isDisabled: r.isDisabled, gender: r.gender, joiningDate: r.joiningDate });
  const ssf = new Set(slips.filter((s) => Number(s.ssfEmployee) > 0).map((s) => s.employeeId));

  const split = new Map<string, TaxSplit>();
  for (const [employeeId, f] of facts) {
    const employee = { id: employeeId, ...f };
    const band = socialSecurityBand(slabsForEmployee(employee, tax.slabs));
    const sstOn = (annual: Decimal) => (band ? calculateAnnualTaxFromSlabs(Decimal.min(annual, band), employee, tax.slabs, tax.control, false) : new Decimal(0));
    const items = [
      ...slips.filter((s) => s.employeeId === employeeId).map((s) => slipTaxItem(s, Number(s.ssfEmployee) > 0)),
      ...settlements.filter((s) => s.employeeId === employeeId).map((s) => settlementTaxItem(s, ssf.has(employeeId))),
    ];
    for (const [key, value] of splitSocialSecurityTax(items, sstOn)) split.set(key, value);
  }
  return { slips, settlements, split, ssf, facts };
}

// ── Monthly files ───────────────────────────────────────────────────────────

const EMPTY_MONTH = (periods: PayPeriodOption[], partialScope: boolean, permissions: StatutoryMonthData['permissions']): StatutoryMonthData => ({
  periods,
  period: null,
  partialScope,
  etds: { rows: [], lines: [], vouchers: [], totals: { gross: '0.00', sst: '0.00', remuneration: '0.00', tds: '0.00' }, withoutPan: 0, nilPayees: 0 },
  ssf: { rows: [], totals: { base: '0.00', employee: '0.00', employer: '0.00', total: '0.00' }, missingNumbers: 0 },
  pf: { rows: [], totals: { base: '0.00', employee: '0.00', employer: '0.00', total: '0.00' }, missingNumbers: 0 },
  cit: { rows: [], total: '0.00', missingNumbers: 0 },
  permissions,
});

const sumOf = <T>(rows: readonly T[], f: (r: T) => string) => rows.reduce((s, r) => s.plus(f(r)), new Decimal(0)).toFixed(2);

/** BS (year, month) of a payment instant, by the Kathmandu calendar date. */
function bsMonthOf(at: Date): { year: number; month: number } {
  const bs = adToBS(new Date(`${nepalDateIso(at)}T00:00:00`));
  return { year: bs.year, month: bs.month };
}

/** Months with a final run, plus months in which a final settlement was paid (their TDS needs filing too). */
async function filingMonths(): Promise<repo.PayPeriodRow[]> {
  const [runs, paidDates, years] = await Promise.all([repo.payPeriods(), repo.settlementPaidDates(), repo.allFiscalYears()]);
  const months = runs.filter((p) => p.finalRuns > 0);
  for (const at of paidDates) {
    const { year, month } = bsMonthOf(at);
    if (months.some((p) => p.year === year && p.month === month)) continue;
    const day = `${year}-${pad(month)}-01`;
    const fy = years.find((y) => String(y.startDateBS) <= day && day <= String(y.endDateBS));
    if (!fy) continue;
    const runsThen = runs.find((p) => p.year === year && p.month === month);
    months.push({ year, month, fiscalYearId: fy.id, finalRuns: 0, lockedRuns: 0, openRuns: runsThen?.openRuns ?? 0 });
  }
  return months.sort((a, b) => b.year - a.year || b.month - a.month);
}

export async function statutoryMonth(ctx: StatutoryCtx, period: unknown, permissions: StatutoryMonthData['permissions']): Promise<StatutoryMonthData> {
  const final = await filingMonths();
  const periods: PayPeriodOption[] = final.map((p) => ({
    value: periodValue(p.year, p.month),
    label: monthLabel(p.year, p.month),
    finalRuns: p.finalRuns,
    lockedRuns: p.lockedRuns,
    openRuns: p.openRuns,
  }));
  const partialScope = ctx.scope.scopeType !== 'GLOBAL';
  const wanted = parsePeriod(period);
  const chosen = (wanted && final.find((p) => p.year === wanted.year && p.month === wanted.month)) || final[0];
  if (!chosen) return EMPTY_MONTH(periods, partialScope, permissions);

  const fy = await repo.fiscalYear(chosen.fiscalYearId);
  if (!fy) throw new UserFacingError('The fiscal year of this pay month is missing.');
  const book = await yearBook(fy, { scope: buildEmployeeScopeCondition(ctx.scope), upToFiscalMonth: getFiscalMonthIndex(chosen.month) });

  const inMonth = <T extends { payYear: number; payMonth: number }>(x: T) => x.payYear === chosen.year && x.payMonth === chosen.month;
  const slips = book.slips.filter(inMonth);
  const settlements = book.settlements.filter(inMonth);
  const rows = [
    ...slips.filter((s) => Number(s.tds) > 0).map((s) => tdsRowFromSlip(s, book.split.get(s.slipId))),
    ...settlements.filter((s) => Number(s.tds) > 0).map((s) => tdsRowFromSettlement(s, book.split.get(s.settlementId))),
  ];
  const lines = etdsLines(rows);
  const taxed = new Set(rows.map((r) => r.employeeId));

  return {
    periods,
    period: {
      value: periodValue(chosen.year, chosen.month),
      year: chosen.year,
      month: chosen.month,
      label: monthLabel(chosen.year, chosen.month),
      fiscalYearLabel: fy.label,
      due: { tds: dueAfter(chosen.year, chosen.month, ruleDays('tds')), ssf: dueAfter(chosen.year, chosen.month, ruleDays('ssf')) },
      finalRuns: chosen.finalRuns,
      lockedRuns: chosen.lockedRuns,
      openRuns: chosen.openRuns,
    },
    partialScope,
    etds: {
      rows,
      lines,
      vouchers: voucherSummary(lines),
      totals: { gross: sumOf(rows, (r) => r.gross), sst: sumOf(rows, (r) => r.sst), remuneration: sumOf(rows, (r) => r.remuneration), tds: sumOf(rows, (r) => r.tds) },
      withoutPan: new Set(rows.filter((r) => !r.pan).map((r) => r.employeeId)).size,
      nilPayees: new Set(slips.filter((s) => !taxed.has(s.employeeId)).map((s) => s.employeeId)).size,
    },
    ssf: ssfSchedule(slips),
    pf: pfSchedule(slips),
    cit: citSchedule(slips),
    permissions,
  };
}

export interface StatutoryFileOut {
  filename: string;
  content: string;
  rows: number;
  label: string;
}

/** The upload file for one month, built on the server from the same figures as the screen. */
export async function statutoryFile(ctx: StatutoryCtx, file: unknown, period: unknown): Promise<StatutoryFileOut> {
  if (!STATUTORY_FILES.includes(file as StatutoryFile)) throw new UserFacingError('Unknown statutory file.');
  const kind = file as StatutoryFile;
  const data = await statutoryMonth(ctx, period, { export: true });
  const wanted = parsePeriod(period);
  if (!data.period || !wanted || data.period.year !== wanted.year || data.period.month !== wanted.month) throw new UserFacingError('That month has no approved payroll.');
  const value = data.period.value;
  switch (kind) {
    case 'etds':
      return { filename: `etds_${value}.csv`, content: etdsCsv(data.etds.lines), rows: data.etds.lines.length, label: `eTDS ${value}` };
    case 'ssf':
      return { filename: `ssf_${value}.csv`, content: ssfCsv(data.ssf), rows: data.ssf.rows.length, label: `SSF schedule ${value}` };
    case 'pf':
      return { filename: `pf_${value}.csv`, content: pfCsv(data.pf), rows: data.pf.rows.length, label: `PF statement ${value}` };
    case 'cit':
      return { filename: `cit_${value}.csv`, content: citCsv(data.cit), rows: data.cit.rows.length, label: `CIT statement ${value}` };
  }
}

// ── Annual tax certificate ──────────────────────────────────────────────────

export async function certificateList(ctx: StatutoryCtx, fiscalYearId: unknown): Promise<CertificateListData> {
  const years = await repo.fiscalYearsWithFinalRuns();
  const partialScope = ctx.scope.scopeType !== 'GLOBAL';
  const picked = years.find((y) => y.id === fiscalYearId) ?? years[0];
  if (!picked) return { fiscalYears: [], fiscalYearId: null, rows: [], partialScope };
  const fy = await repo.fiscalYear(picked.id);
  if (!fy) return { fiscalYears: years.map((y) => ({ id: y.id, label: y.label })), fiscalYearId: null, rows: [], partialScope };
  const book = await yearBook(fy, { scope: buildEmployeeScopeCondition(ctx.scope) });

  const acc = new Map<string, CertificateListRow & { monthKeys: Set<string> }>();
  const row = (p: { employeeId: string; employeeCode: string; employeeName: string; pan: string | null }) => {
    const existing = acc.get(p.employeeId);
    if (existing) return existing;
    const created = { employeeId: p.employeeId, employeeCode: p.employeeCode, employeeName: p.employeeName, pan: p.pan, months: 0, gross: '0.00', taxable: '0.00', tds: '0.00', monthKeys: new Set<string>() };
    acc.set(p.employeeId, created);
    return created;
  };
  const add = (a: string, b: string) => new Decimal(a).plus(b || 0).toFixed(2);
  for (const s of book.slips) {
    const r = row(s);
    r.monthKeys.add(periodValue(s.payYear, s.payMonth));
    r.gross = add(r.gross, s.grossEarnings);
    r.taxable = add(r.taxable, s.taxableIncome);
    r.tds = add(r.tds, s.tds);
  }
  for (const s of book.settlements) {
    const r = row(s);
    r.gross = add(r.gross, s.earnings);
    r.taxable = add(r.taxable, s.taxable);
    r.tds = add(r.tds, s.tds);
  }
  const rows = [...acc.values()]
    .map(({ monthKeys, ...r }) => ({ ...r, months: monthKeys.size }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return { fiscalYears: years.map((y) => ({ id: y.id, label: y.label })), fiscalYearId: fy.id, rows, partialScope };
}

function certificateFrom(fy: { id: string; label: string }, book: YearBook, employeeId: string): TaxCertificateData | null {
  const slips = book.slips.filter((s) => s.employeeId === employeeId).sort((a, b) => a.fiscalMonthIndex - b.fiscalMonthIndex);
  const settlements = book.settlements.filter((s) => s.employeeId === employeeId);
  const latest = slips[slips.length - 1] ?? settlements[0];
  if (!latest) return null;
  const split = (key: string, tds: string) => book.split.get(key) ?? { sst: '0.00', remuneration: new Decimal(tds || 0).toFixed(2) };
  const lines: CertificateLine[] = [
    ...slips.map((s) => {
      const t = split(s.slipId, s.tds);
      return {
        label: monthLabel(s.payYear, s.payMonth),
        labelNp: monthLabelNp(s.payYear, s.payMonth),
        source: 'payroll' as const,
        paymentDateBs: s.paymentDateBs,
        gross: new Decimal(s.grossEarnings || 0).toFixed(2),
        retirement: slipRetirement(s),
        taxable: new Decimal(s.taxableIncome || 0).toFixed(2),
        sst: t.sst,
        remuneration: t.remuneration,
        tds: new Decimal(s.tds || 0).toFixed(2),
      };
    }),
    ...settlements.map((s) => {
      const t = split(s.settlementId, s.tds);
      return {
        label: 'Final settlement',
        labelNp: 'अन्तिम भुक्तानी',
        source: 'settlement' as const,
        paymentDateBs: s.paymentDateBs,
        gross: new Decimal(s.earnings || 0).toFixed(2),
        retirement: '0.00',
        taxable: new Decimal(s.taxable || 0).toFixed(2),
        sst: t.sst,
        remuneration: t.remuneration,
        tds: new Decimal(s.tds || 0).toFixed(2),
      };
    }),
  ];
  const totals = certificateTotals(lines);
  const facts = book.facts.get(employeeId);
  return {
    fiscalYearId: fy.id,
    fiscalYearLabel: fy.label,
    employee: { id: employeeId, code: latest.employeeCode, name: latest.employeeName, pan: latest.pan, taxStatus: facts?.taxStatus ?? '', ssf: book.ssf.has(employeeId) },
    lines,
    totals,
    revenue: [
      { code: REVENUE_CODE.socialSecurityTax, ...REVENUE_CODE_LABEL[REVENUE_CODE.socialSecurityTax], amount: totals.sst },
      { code: REVENUE_CODE.remunerationTax, ...REVENUE_CODE_LABEL[REVENUE_CODE.remunerationTax], amount: totals.remuneration },
    ],
    issuedOnAd: nepalDateIso(),
    issuedOnBs: adToBSString(nepalToday()),
  };
}

/** One employee's certificate for a fiscal year, within the viewer's scope; null when nothing is final. */
export async function certificate(ctx: StatutoryCtx, fiscalYearId: unknown, employeeId: unknown): Promise<TaxCertificateData | null> {
  if (typeof fiscalYearId !== 'string' || typeof employeeId !== 'string' || !fiscalYearId || !employeeId) return null;
  const fy = await repo.fiscalYear(fiscalYearId);
  if (!fy) return null;
  const book = await yearBook(fy, { scope: buildEmployeeScopeCondition(ctx.scope), employeeId });
  return certificateFrom(fy, book, employeeId);
}

/**
 * The employee's own certificate (self-service): the caller passes the employee from the
 * session and the portal's payslip visibility rule, so only released payslips count.
 */
export async function ownCertificate(
  employeeId: string,
  fiscalYearId: unknown,
  visibleSlip: SQL[],
): Promise<{ fiscalYears: { id: string; label: string }[]; certificate: TaxCertificateData | null }> {
  const years = await repo.fiscalYearsWithFinalRuns({ employeeId, extra: visibleSlip });
  const picked = years.find((y) => y.id === fiscalYearId) ?? years[0];
  const fiscalYears = years.map((y) => ({ id: y.id, label: y.label }));
  if (!picked) return { fiscalYears, certificate: null };
  const fy = await repo.fiscalYear(picked.id);
  if (!fy) return { fiscalYears, certificate: null };
  const book = await yearBook(fy, { employeeId, extra: visibleSlip });
  return { fiscalYears, certificate: certificateFrom(fy, book, employeeId) };
}
