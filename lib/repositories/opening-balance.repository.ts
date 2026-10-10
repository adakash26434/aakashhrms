import { and, asc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { branches, employees, fiscalYears, payrollOpeningBalances, payrollRuns, payrollSlips } from "@/lib/db/schema";
import type { OpeningAmounts } from "@/lib/engines/opening-balance.engine";

// Opening balances (4.8 / F15): queries only. The rules are in lib/engines/opening-balance.engine.ts.

export interface OpeningRow extends OpeningAmounts {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface NewOpening extends OpeningAmounts {
  employeeId: string;
  fiscalYearId: string;
  note: string | null;
}

/** Fiscal month of a run (Shrawan = 1 … Ashadh = 12). */
const fiscalIndex = sql<number>`(CASE WHEN ${payrollRuns.payPeriodMonth} >= 4 THEN ${payrollRuns.payPeriodMonth} - 3 ELSE ${payrollRuns.payPeriodMonth} + 9 END)`;

const amounts = (r: typeof payrollOpeningBalances.$inferSelect): OpeningAmounts => ({
  months: r.months,
  grossEarnings: r.grossEarnings,
  retirement: r.retirement,
  cit: r.cit,
  taxableIncome: r.taxableIncome,
  sst: r.sst,
  incomeTax: r.incomeTax,
});

/** The fiscal year payroll runs in (the active one). */
export async function activeFiscalYear(): Promise<{ id: string; label: string; startDateBS: string } | null> {
  const [row] = await (await getDb())
    .select({ id: fiscalYears.id, label: fiscalYears.label, startDateBS: fiscalYears.startDateBS })
    .from(fiscalYears)
    .where(eq(fiscalYears.status, "Active"))
    .limit(1);
  return row ?? null;
}

/** A fiscal year's opening balances for the employees a scope condition allows. */
export async function findOpenings(fiscalYearId: string, scope?: SQL): Promise<OpeningRow[]> {
  const rows = await (await getDb())
    .select({ o: payrollOpeningBalances, code: employees.employeeCode, name: employees.fullName, branchId: employees.branchId, branchName: branches.name })
    .from(payrollOpeningBalances)
    .innerJoin(employees, eq(employees.id, payrollOpeningBalances.employeeId))
    .leftJoin(branches, eq(branches.id, employees.branchId))
    .where(and(eq(payrollOpeningBalances.fiscalYearId, fiscalYearId), scope))
    .orderBy(asc(employees.employeeCode));
  return rows.map((r) => ({
    ...amounts(r.o),
    id: r.o.id,
    employeeId: r.o.employeeId,
    employeeCode: r.code,
    employeeName: r.name,
    branchId: r.branchId,
    branchName: r.branchName ?? "",
    note: r.o.note,
    updatedAt: r.o.updatedAt.toISOString(),
    updatedBy: r.o.updatedBy,
  }));
}

/** Opening balances by employee for a fiscal year. */
export async function openingsFor(employeeIds: string[], fiscalYearId: string): Promise<Map<string, OpeningAmounts>> {
  if (!employeeIds.length) return new Map();
  const rows = await (await getDb())
    .select()
    .from(payrollOpeningBalances)
    .where(and(inArray(payrollOpeningBalances.employeeId, employeeIds), eq(payrollOpeningBalances.fiscalYearId, fiscalYearId)));
  return new Map(rows.map((r) => [r.employeeId, amounts(r)]));
}

/** Employees whose opening balance covers a fiscal month (a run here must not pay it again). */
export async function openingsCovering(employeeIds: string[], fiscalYearId: string, fiscalMonthIndex: number): Promise<{ employeeCode: string; fullName: string; months: number }[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select({ employeeCode: employees.employeeCode, fullName: employees.fullName, months: payrollOpeningBalances.months })
    .from(payrollOpeningBalances)
    .innerJoin(employees, eq(employees.id, payrollOpeningBalances.employeeId))
    .where(and(inArray(payrollOpeningBalances.employeeId, employeeIds), eq(payrollOpeningBalances.fiscalYearId, fiscalYearId), gte(payrollOpeningBalances.months, fiscalMonthIndex)))
    .orderBy(asc(employees.employeeCode));
}

/** Fiscal months with a payslip here (any state), per employee. */
export async function slipMonthsFor(employeeIds: string[], fiscalYearId: string): Promise<Map<string, { index: number; status: string }[]>> {
  const out = new Map<string, { index: number; status: string }[]>();
  if (!employeeIds.length) return out;
  const rows = await (await getDb())
    .select({ employeeId: payrollSlips.employeeId, index: fiscalIndex, status: payrollRuns.status })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollSlips.payrollRunId))
    .where(and(inArray(payrollSlips.employeeId, employeeIds), eq(payrollRuns.fiscalYearId, fiscalYearId)));
  for (const r of rows) out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), { index: Number(r.index), status: r.status }]);
  return out;
}

/** Saves opening balances: one per employee and year, a new one replacing the old. Returns how many were saved. */
export async function upsertOpenings(rows: readonly NewOpening[], userId: string): Promise<number> {
  if (!rows.length) return 0;
  const now = new Date();
  const saved = await (await getDb())
    .insert(payrollOpeningBalances)
    .values(rows.map((r) => ({ ...r, createdBy: userId, updatedBy: userId, updatedAt: now })))
    .onConflictDoUpdate({
      target: [payrollOpeningBalances.employeeId, payrollOpeningBalances.fiscalYearId],
      set: {
        months: sql`excluded.months`,
        grossEarnings: sql`excluded.gross_earnings`,
        retirement: sql`excluded.retirement`,
        cit: sql`excluded.cit`,
        taxableIncome: sql`excluded.taxable_income`,
        sst: sql`excluded.sst`,
        incomeTax: sql`excluded.income_tax`,
        note: sql`excluded.note`,
        updatedBy: userId,
        updatedAt: now,
      },
    })
    .returning({ id: payrollOpeningBalances.id });
  return saved.length;
}

export async function findOpeningById(id: string): Promise<{ id: string; employeeId: string; fiscalYearId: string; months: number } | null> {
  const [row] = await (await getDb())
    .select({ id: payrollOpeningBalances.id, employeeId: payrollOpeningBalances.employeeId, fiscalYearId: payrollOpeningBalances.fiscalYearId, months: payrollOpeningBalances.months })
    .from(payrollOpeningBalances)
    .where(eq(payrollOpeningBalances.id, id))
    .limit(1);
  return row ?? null;
}

/** Removes an opening balance; false when it was already gone. */
export async function deleteOpening(id: string): Promise<boolean> {
  const rows = await (await getDb()).delete(payrollOpeningBalances).where(eq(payrollOpeningBalances.id, id)).returning({ id: payrollOpeningBalances.id });
  return rows.length > 0;
}
