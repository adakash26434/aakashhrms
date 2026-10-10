import { getDb } from '@/lib/db';
import { employeePersonal, employees, exitSettlements, fiscalYears, payrollOpeningBalances, payrollRuns, payrollSlips } from '@/lib/db/schema';
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';

// Statutory deposit files (4.8 / F9): Drizzle queries only. Rules live in
// lib/engines/statutory-returns.engine.ts; orchestration in lib/services/statutory.service.ts.
// Only payslips of APPROVED or LOCKED runs ever reach a deposit file or a certificate.

export const FINAL_RUN_STATUSES = ['APPROVED', 'LOCKED'] as const;

/** Fiscal month of a BS pay month in SQL: Shrawan (4) = 1 … Ashadh (3) = 12. */
const fiscalMonthOf = (month: SQL | typeof payrollRuns.payPeriodMonth) => sql<number>`(CASE WHEN ${month} >= 4 THEN ${month} - 3 ELSE ${month} + 9 END)`;

export interface PayPeriodRow {
  year: number;
  month: number;
  fiscalYearId: string;
  finalRuns: number;
  lockedRuns: number;
  openRuns: number;
}

/** Pay periods with at least one run, newest first, with how many runs are final, locked and still open. */
export async function payPeriods(): Promise<PayPeriodRow[]> {
  const rows = await (await getDb())
    .select({
      year: payrollRuns.payPeriodYear,
      month: payrollRuns.payPeriodMonth,
      fiscalYearId: payrollRuns.fiscalYearId,
      finalRuns: sql<number>`count(*) FILTER (WHERE ${inArray(payrollRuns.status, [...FINAL_RUN_STATUSES])})::int`,
      lockedRuns: sql<number>`count(*) FILTER (WHERE ${eq(payrollRuns.status, 'LOCKED')})::int`,
      openRuns: sql<number>`count(*) FILTER (WHERE ${inArray(payrollRuns.status, ['DRAFT', 'UNDER_REVIEW'])})::int`,
    })
    .from(payrollRuns)
    .groupBy(payrollRuns.payPeriodYear, payrollRuns.payPeriodMonth, payrollRuns.fiscalYearId)
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth));
  return rows;
}

export async function fiscalYear(id: string) {
  const [row] = await (await getDb())
    .select({ id: fiscalYears.id, label: fiscalYears.label, startDateAD: fiscalYears.startDateAD, endDateAD: fiscalYears.endDateAD, startDateBS: fiscalYears.startDateBS })
    .from(fiscalYears)
    .where(eq(fiscalYears.id, id))
    .limit(1);
  return row ?? null;
}

/** Every fiscal year (to place a settlement-only month in its year). */
export async function allFiscalYears() {
  return (await getDb()).select({ id: fiscalYears.id, startDateBS: fiscalYears.startDateBS, endDateBS: fiscalYears.endDateBS }).from(fiscalYears);
}

/** When paid final settlements were paid (their months need a TDS file even without a pay run). */
export async function settlementPaidDates(): Promise<Date[]> {
  const rows = await (await getDb())
    .select({ paidAt: sql<Date>`${exitSettlements.paidAt}` })
    .from(exitSettlements)
    .where(eq(exitSettlements.status, 'paid'));
  return rows.map((r) => new Date(r.paidAt));
}

/** Fiscal years with a payslip in an approved / locked run (optionally one employee's, with extra conditions), newest first. */
export async function fiscalYearsWithFinalRuns(f: { employeeId?: string; extra?: SQL[] } = {}) {
  return (await getDb())
    .selectDistinct({ id: fiscalYears.id, label: fiscalYears.label, startDateAD: fiscalYears.startDateAD })
    .from(fiscalYears)
    .innerJoin(payrollRuns, eq(payrollRuns.fiscalYearId, fiscalYears.id))
    .innerJoin(payrollSlips, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollRuns.status, [...FINAL_RUN_STATUSES]), f.employeeId ? eq(payrollSlips.employeeId, f.employeeId) : undefined, ...(f.extra ?? [])))
    .orderBy(desc(fiscalYears.startDateAD));
}

export interface SlipFactRow {
  slipId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
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
  payslipDate: string | null;
  isYearEnd: boolean;
  taxSheet: unknown;
  payYear: number;
  payMonth: number;
  runStatus: string;
  /** F6: REGULAR | FESTIVAL | ARREARS. */
  runType: string;
  category: string;
  taxStatus: string;
  isDisabled: boolean;
  gender: string;
  joiningDate: string;
  pan: string | null;
  ssfNumber: string | null;
  pfNumber: string | null;
  citNumber: string | null;
}

export interface SlipFactFilter {
  fiscalYearId: string;
  /** Only pay months up to this fiscal month (1–12). */
  upToFiscalMonth?: number;
  employeeId?: string;
  /** buildEmployeeScopeCondition for the viewer (undefined = whole company). */
  scope?: SQL;
  /** Extra conditions (the portal passes its visibility rule). */
  extra?: SQL[];
}

/** Payslips of approved / locked runs in a fiscal year, with the employee's tax and fund facts. */
export async function slipFacts(f: SlipFactFilter): Promise<SlipFactRow[]> {
  const conditions: (SQL | undefined)[] = [
    eq(payrollRuns.fiscalYearId, f.fiscalYearId),
    inArray(payrollRuns.status, [...FINAL_RUN_STATUSES]),
    f.upToFiscalMonth ? sql`${fiscalMonthOf(payrollRuns.payPeriodMonth)} <= ${f.upToFiscalMonth}` : undefined,
    f.employeeId ? eq(payrollSlips.employeeId, f.employeeId) : undefined,
    f.scope,
    ...(f.extra ?? []),
  ];
  return (await getDb())
    .select({
      slipId: payrollSlips.id,
      employeeId: payrollSlips.employeeId,
      employeeCode: payrollSlips.employeeCode,
      employeeName: payrollSlips.employeeName,
      basicSalary: payrollSlips.basicSalary,
      gradeAmount: payrollSlips.gradeAmount,
      grossEarnings: payrollSlips.grossEarnings,
      taxableIncome: payrollSlips.taxableIncome,
      tds: payrollSlips.tdsThisMonth,
      ssfEmployee: payrollSlips.ssfEmployee,
      ssfEmployer: payrollSlips.ssfEmployer,
      pfEmployee: payrollSlips.pfEmployee,
      pfEmployer: payrollSlips.pfEmployer,
      cit: payrollSlips.citDeduction,
      payslipDate: payrollSlips.payslipDate,
      isYearEnd: payrollSlips.isYearEndReconciliation,
      taxSheet: payrollSlips.taxSheet,
      payYear: payrollRuns.payPeriodYear,
      payMonth: payrollRuns.payPeriodMonth,
      runStatus: payrollRuns.status,
      runType: payrollRuns.runType,
      category: employees.category,
      taxStatus: employees.taxStatus,
      isDisabled: employees.isDisabled,
      gender: employees.gender,
      joiningDate: sql<string>`${employees.joiningDate}::text`,
      pan: employeePersonal.panNumber,
      ssfNumber: employeePersonal.ssfNumber,
      pfNumber: employeePersonal.pfNumber,
      citNumber: employeePersonal.citNumber,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(payrollRuns.payPeriodYear), asc(payrollRuns.payPeriodMonth), asc(payrollSlips.employeeName));
}

export interface OpeningFactRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  pan: string | null;
  months: number;
  grossEarnings: string;
  retirement: string;
  cit: string;
  taxableIncome: string;
  sst: string;
  incomeTax: string;
  category: string;
  taxStatus: string;
  isDisabled: boolean;
  gender: string;
  joiningDate: string;
}

/** F15: a fiscal year's opening balances (what an old system paid before payroll started here). */
export async function openingFacts(f: { fiscalYearId: string; upToFiscalMonth?: number; employeeId?: string; scope?: SQL }): Promise<OpeningFactRow[]> {
  return (await getDb())
    .select({
      employeeId: payrollOpeningBalances.employeeId,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
      pan: employeePersonal.panNumber,
      months: payrollOpeningBalances.months,
      grossEarnings: payrollOpeningBalances.grossEarnings,
      retirement: payrollOpeningBalances.retirement,
      cit: payrollOpeningBalances.cit,
      taxableIncome: payrollOpeningBalances.taxableIncome,
      sst: payrollOpeningBalances.sst,
      incomeTax: payrollOpeningBalances.incomeTax,
      category: employees.category,
      taxStatus: employees.taxStatus,
      isDisabled: employees.isDisabled,
      gender: employees.gender,
      joiningDate: sql<string>`${employees.joiningDate}::text`,
    })
    .from(payrollOpeningBalances)
    .innerJoin(employees, eq(payrollOpeningBalances.employeeId, employees.id))
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .where(
      and(
        eq(payrollOpeningBalances.fiscalYearId, f.fiscalYearId),
        f.upToFiscalMonth ? sql`${payrollOpeningBalances.months} <= ${f.upToFiscalMonth}` : undefined,
        f.employeeId ? eq(payrollOpeningBalances.employeeId, f.employeeId) : undefined,
        f.scope,
      ),
    );
}

export interface SettlementFactRow {
  settlementId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  lines: unknown;
  earnings: string;
  taxSheet: unknown;
  paidAt: Date;
  category: string;
  taxStatus: string;
  isDisabled: boolean;
  gender: string;
  joiningDate: string;
  pan: string | null;
  ssfNumber: string | null;
  pfNumber: string | null;
  citNumber: string | null;
}

/** Final settlements (F8) marked paid in [fromAd, toAd), with the employee's facts. */
export async function paidSettlements(f: { fromAd: Date; toAd: Date; employeeId?: string; scope?: SQL }): Promise<SettlementFactRow[]> {
  return (await getDb())
    .select({
      settlementId: exitSettlements.id,
      employeeId: exitSettlements.employeeId,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
      lines: exitSettlements.lines,
      earnings: exitSettlements.earnings,
      taxSheet: exitSettlements.taxSheet,
      paidAt: sql<Date>`${exitSettlements.paidAt}`,
      category: employees.category,
      taxStatus: employees.taxStatus,
      isDisabled: employees.isDisabled,
      gender: employees.gender,
      joiningDate: sql<string>`${employees.joiningDate}::text`,
      pan: employeePersonal.panNumber,
      ssfNumber: employeePersonal.ssfNumber,
      pfNumber: employeePersonal.pfNumber,
      citNumber: employeePersonal.citNumber,
    })
    .from(exitSettlements)
    .innerJoin(employees, eq(exitSettlements.employeeId, employees.id))
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .where(
      and(
        eq(exitSettlements.status, 'paid'),
        gte(exitSettlements.paidAt, f.fromAd),
        lt(exitSettlements.paidAt, f.toAd),
        f.employeeId ? eq(exitSettlements.employeeId, f.employeeId) : undefined,
        f.scope,
      ),
    )
    .orderBy(asc(exitSettlements.paidAt));
}
