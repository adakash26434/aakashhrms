import { getDb } from '@/lib/db';
import {
  attendanceRecords,
  employeeLeaveBalances,
  employeeSalaryMap,
  evaluationCycles,
  fiscalYears,
  hrLetters,
  leaveApplications,
  leaveLedger,
  leaveOtCalculations,
  leaveRules,
  leaveSalaryRuns,
  leaveYearOpenings,
  letterSequences,
  payrollOpeningBalances,
  payrollRuns,
  taxRateSlabs,
} from '@/lib/db/schema';
import { and, eq, gte, like, lte, ne, notInArray, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { BSMonthNumber, FiscalYear, FiscalYearStatus } from '@/lib/types/fiscal-year';

// Fiscal years (4.12). Statuses: Active (the current year, exactly one), Inactive (open) and
// Locked (closed). Anything else an older build may have written reads as open, so it can be
// closed properly. Every move is claim-first on the status the year must have now.

type FiscalYearRow = typeof fiscalYears.$inferSelect;

const statusOf = (raw: string): FiscalYearStatus => (raw === 'Active' || raw === 'Locked' ? raw : 'Inactive');

/** Open: neither current nor closed (older statuses included). */
const isOpen = notInArray(fiscalYears.status, ['Active', 'Locked']);

function mapRowToFiscalYear(row: FiscalYearRow): FiscalYear {
  return {
    id: row.id,
    label: row.label,
    slug: row.slug,
    fromMonth: row.fromMonth as unknown as BSMonthNumber,
    toMonth: row.toMonth as unknown as BSMonthNumber,
    startDateAD: row.startDateAD,
    endDateAD: row.endDateAD,
    startDateBS: row.startDateBS,
    endDateBS: row.endDateBS,
    status: statusOf(row.status),
    payslipsGenerated: row.payslipsGenerated,
  };
}

export async function findAllFiscalYears(): Promise<FiscalYear[]> {
  const rows = await (await getDb()).select().from(fiscalYears);
  return rows.map(mapRowToFiscalYear);
}

export async function findFiscalYearById(id: string): Promise<FiscalYear | undefined> {
  const rows = await (await getDb()).select().from(fiscalYears).where(eq(fiscalYears.id, id));
  return rows.length ? mapRowToFiscalYear(rows[0]) : undefined;
}

/** The fiscal year opening in BS year `openingYear` (its Shrawan 1 is "YYYY-04-01"). */
export async function findByOpeningYear(openingYear: number): Promise<FiscalYear | undefined> {
  const rows = await (await getDb()).select().from(fiscalYears).where(like(fiscalYears.startDateBS, `${openingYear}-%`)).limit(1);
  return rows.length ? mapRowToFiscalYear(rows[0]) : undefined;
}

export interface YearUsage {
  key: string;
  label: string;
  count: number;
}

/**
 * What belongs to each year (its own tax slabs aside), one grouped count per
 * table — every table that points at a fiscal year, so a year in use is never
 * offered for deletion.
 */
export async function usageByYear(): Promise<Map<string, YearUsage[]>> {
  const db = await getDb();
  const grouped = (column: AnyPgColumn, table: PgTable) =>
    db.select({ fy: sql<string | null>`${column}`, n: sql<number>`count(*)` }).from(table).groupBy(column);
  const kinds: [key: string, one: string, many: string, queries: ReturnType<typeof grouped>[]][] = [
    ['payRuns', 'pay run', 'pay runs', [grouped(payrollRuns.fiscalYearId, payrollRuns)]],
    ['leaveLedger', 'leave ledger line', 'leave ledger lines', [grouped(leaveLedger.fiscalYearId, leaveLedger)]],
    ['leaveRequests', 'leave request', 'leave requests', [grouped(leaveApplications.fiscalYearId, leaveApplications)]],
    ['leaveBalances', 'leave balance', 'leave balances', [grouped(employeeLeaveBalances.fiscalYearId, employeeLeaveBalances)]],
    ['leaveOpenings', 'leave year opening', 'leave year openings', [grouped(leaveYearOpenings.fiscalYearId, leaveYearOpenings), grouped(leaveYearOpenings.fromFiscalYearId, leaveYearOpenings)]],
    ['leaveSalary', 'leave salary record', 'leave salary records', [grouped(leaveSalaryRuns.fiscalYearId, leaveSalaryRuns)]],
    ['leaveRules', 'leave rule', 'leave rules', [grouped(leaveRules.fiscalYearId, leaveRules)]],
    ['attendance', 'attendance day', 'attendance days', [grouped(attendanceRecords.fiscalYearId, attendanceRecords)]],
    ['attendanceMonths', 'attendance month summary', 'attendance month summaries', [grouped(leaveOtCalculations.fiscalYearId, leaveOtCalculations)]],
    ['salaryStructures', 'salary structure', 'salary structures', [grouped(employeeSalaryMap.fiscalYearId, employeeSalaryMap)]],
    ['openingBalances', 'opening balance', 'opening balances', [grouped(payrollOpeningBalances.fiscalYearId, payrollOpeningBalances)]],
    ['letters', 'HR letter', 'HR letters', [grouped(hrLetters.fiscalYearId, hrLetters)]],
    ['letterNumbers', 'letter number series', 'letter number series', [grouped(letterSequences.fiscalYearId, letterSequences)]],
    ['evaluationCycles', 'evaluation cycle', 'evaluation cycles', [grouped(evaluationCycles.fiscalYearId, evaluationCycles)]],
  ];
  const results = await Promise.all(kinds.map(([, , , queries]) => Promise.all(queries)));
  const byYear = new Map<string, YearUsage[]>();
  kinds.forEach(([key, one, many], i) => {
    const counts = new Map<string, number>();
    for (const rows of results[i]) for (const r of rows) if (r.fy) counts.set(r.fy, (counts.get(r.fy) ?? 0) + Number(r.n));
    for (const [fy, count] of counts) {
      if (count > 0) byYear.set(fy, [...(byYear.get(fy) ?? []), { key, label: count === 1 ? one : many, count }]);
    }
  });
  return byYear;
}

/** Whether the year has its Individual tax ladder (the one every category falls back to). */
export async function hasIndividualLadder(fiscalYearId: string): Promise<boolean> {
  const rows = await (await getDb())
    .select({ id: taxRateSlabs.id })
    .from(taxRateSlabs)
    .where(and(eq(taxRateSlabs.fiscalYearId, fiscalYearId), eq(taxRateSlabs.category, 'Normal Single')))
    .limit(1);
  return rows.length > 0;
}

/** Whether any pay run (any status) belongs to the year. */
export async function hasPayRuns(fiscalYearId: string): Promise<boolean> {
  const rows = await (await getDb()).select({ id: payrollRuns.id }).from(payrollRuns).where(eq(payrollRuns.fiscalYearId, fiscalYearId)).limit(1);
  return rows.length > 0;
}

/** Pay runs not locked yet, per year. */
export async function openRunsByYear(): Promise<Map<string, number>> {
  const rows = await (await getDb())
    .select({ fy: payrollRuns.fiscalYearId, n: sql<number>`count(*)` })
    .from(payrollRuns)
    .where(ne(payrollRuns.status, 'LOCKED'))
    .groupBy(payrollRuns.fiscalYearId);
  return new Map(rows.map((r) => [r.fy, Number(r.n)]));
}

/** Slab counts by category for every year (the register's Tax slabs column). */
export async function slabCounts(): Promise<{ fiscalYearId: string; category: string; n: number }[]> {
  const rows = await (await getDb())
    .select({ fiscalYearId: taxRateSlabs.fiscalYearId, category: taxRateSlabs.category, n: sql<number>`count(*)` })
    .from(taxRateSlabs)
    .groupBy(taxRateSlabs.fiscalYearId, taxRateSlabs.category);
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}

export interface NewFiscalYear {
  label: string;
  slug: string;
  fromMonth: number;
  toMonth: number;
  startDateBS: string;
  endDateBS: string;
  startDateAD: string;
  endDateAD: string;
}

/** A new year, not current, with a copy of another year's tax slabs (one transaction). */
export async function insertYearWithSlabs(year: NewFiscalYear, copySlabsFrom: string | null): Promise<FiscalYear> {
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx
      .insert(fiscalYears)
      .values({
        label: year.label,
        slug: year.slug,
        fromMonth: year.fromMonth,
        toMonth: year.toMonth,
        startDateBS: year.startDateBS,
        endDateBS: year.endDateBS,
        startDateAD: new Date(year.startDateAD),
        endDateAD: new Date(year.endDateAD),
        status: 'Inactive',
        payslipsGenerated: false,
      })
      .returning();
    if (copySlabsFrom) {
      const source = await tx.select().from(taxRateSlabs).where(eq(taxRateSlabs.fiscalYearId, copySlabsFrom));
      if (source.length) {
        await tx.insert(taxRateSlabs).values(
          source.map((s) => ({ fiscalYearId: row.id, category: s.category, amountFrom: s.amountFrom, amountTo: s.amountTo, ratePercent: s.ratePercent, fixedDeduction: s.fixedDeduction }))
        );
      }
    }
    return mapRowToFiscalYear(row);
  });
}

/** Makes an open year current; the year current until now becomes open. Closed years are never touched. */
export async function makeCurrent(id: string): Promise<boolean> {
  return (await getDb()).transaction(async (tx) => {
    const [claimed] = await tx
      .update(fiscalYears)
      .set({ status: 'Active', updatedAt: new Date() })
      .where(and(eq(fiscalYears.id, id), isOpen))
      .returning({ id: fiscalYears.id });
    if (!claimed) return false;
    await tx.update(fiscalYears).set({ status: 'Inactive', updatedAt: new Date() }).where(and(eq(fiscalYears.status, 'Active'), ne(fiscalYears.id, id)));
    return true;
  });
}

/** Open → closed (Locked) or back, claim-first on the status the year must have now. */
export async function moveStatus(id: string, from: 'Inactive' | 'Locked', to: 'Inactive' | 'Locked'): Promise<boolean> {
  const rows = await (await getDb())
    .update(fiscalYears)
    .set({ status: to, payslipsGenerated: to === 'Locked', updatedAt: new Date() })
    .where(and(eq(fiscalYears.id, id), from === 'Locked' ? eq(fiscalYears.status, 'Locked') : isOpen))
    .returning({ id: fiscalYears.id });
  return rows.length > 0;
}

/** Deletes an open year with its own tax slabs (false: it is current or closed by now). */
export async function deleteYearWithSlabs(id: string): Promise<boolean> {
  return (await getDb()).transaction(async (tx) => {
    const [year] = await tx.select({ status: fiscalYears.status }).from(fiscalYears).where(eq(fiscalYears.id, id)).for('update');
    if (!year || statusOf(year.status) !== 'Inactive') return false;
    await tx.delete(taxRateSlabs).where(eq(taxRateSlabs.fiscalYearId, id));
    await tx.delete(fiscalYears).where(eq(fiscalYears.id, id));
    return true;
  });
}

/** The fiscal year containing an AD date ("YYYY-MM-DD"), never a locked one; null when none covers it (4.8b). */
export async function findFiscalYearForDate(iso: string): Promise<FiscalYear | null> {
  const at = new Date(`${iso}T06:00:00.000Z`);
  const rows = await (await getDb())
    .select()
    .from(fiscalYears)
    .where(and(lte(fiscalYears.startDateAD, at), gte(fiscalYears.endDateAD, at), ne(fiscalYears.status, 'Locked')));
  const row = rows.find((r) => r.status === 'Active') ?? rows[0];
  return row ? mapRowToFiscalYear(row) : null;
}
