import { getDb } from '@/lib/db';
import { branches, employees, fundLedger, fundTypes } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, like, sql, type SQL } from 'drizzle-orm';

// Welfare funds (G9): Drizzle queries only. The ledger is APPEND-ONLY —
// this file has no update or delete on fund_ledger, and must never grow one;
// corrections are adjustment lines. Rules live in lib/engines/fund.engine.ts.

export type FundTypeRow = typeof fundTypes.$inferSelect;
export type FundLineRow = typeof fundLedger.$inferSelect;

// ---------------------------------------------------------------------------
// Fund types
// ---------------------------------------------------------------------------

export async function listFundTypes(): Promise<FundTypeRow[]> {
  const db = await getDb();
  return db.select().from(fundTypes).orderBy(asc(fundTypes.name));
}

export async function findFundType(id: string): Promise<FundTypeRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(fundTypes).where(eq(fundTypes.id, id)).limit(1);
  return row ?? null;
}

export interface FundTypeWrite {
  code: string;
  name: string;
  nameNp: string;
  contributionMode: string;
  employeeValue: string;
  employerValue: string;
  note: string | null;
  isActive: boolean;
}

export async function insertFundType(data: FundTypeWrite, userId: string): Promise<FundTypeRow> {
  const db = await getDb();
  const [row] = await db.insert(fundTypes).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

/** The code never changes once lines exist under it (refs embed it). */
export async function updateFundType(id: string, data: Omit<FundTypeWrite, 'code'>, userId: string): Promise<FundTypeRow | null> {
  const db = await getDb();
  const [row] = await db.update(fundTypes).set({ ...data, updatedBy: userId }).where(eq(fundTypes.id, id)).returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Ledger (append-only)
// ---------------------------------------------------------------------------

export interface LineInsert {
  fundTypeId: string;
  employeeId: string;
  kind: string;
  employeeAmount: string;
  employerAmount: string;
  ref: string;
  note: string | null;
  postedBy: string | null;
}

/** Idempotent through the (fund, employee, ref) unique key. */
export async function postLines(lines: LineInsert[]): Promise<number> {
  if (!lines.length) return 0;
  const db = await getDb();
  let inserted = 0;
  for (const line of lines) {
    const rows = await db
      .insert(fundLedger)
      .values(line)
      .onConflictDoNothing({ target: [fundLedger.fundTypeId, fundLedger.employeeId, fundLedger.ref] })
      .returning({ id: fundLedger.id });
    inserted += rows.length;
  }
  return inserted;
}

export async function linesFor(fundTypeId: string, employeeId: string, limit = 60): Promise<FundLineRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(fundLedger)
    .where(and(eq(fundLedger.fundTypeId, fundTypeId), eq(fundLedger.employeeId, employeeId)))
    .orderBy(desc(fundLedger.postedAt))
    .limit(limit);
}

export interface BalanceRow {
  fundTypeId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branch: string;
  employeeSum: string;
  employerSum: string;
}

/** Per employee per fund, summed in SQL (numeric, no float), within scope. */
export async function balances(scopeCondition?: SQL<unknown>): Promise<BalanceRow[]> {
  const db = await getDb();
  return db
    .select({
      fundTypeId: fundLedger.fundTypeId,
      employeeId: fundLedger.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      branch: branches.name,
      employeeSum: sql<string>`sum(${fundLedger.employeeAmount})::text`,
      employerSum: sql<string>`sum(${fundLedger.employerAmount})::text`,
    })
    .from(fundLedger)
    .innerJoin(employees, eq(fundLedger.employeeId, employees.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(scopeCondition)
    .groupBy(fundLedger.fundTypeId, fundLedger.employeeId, employees.fullName, employees.employeeCode, branches.name)
    .orderBy(asc(employees.fullName));
}

export interface FundTotalRow {
  fundTypeId: string;
  members: number;
  employeeSum: string;
  employerSum: string;
}

/** The provision figures per fund (for the auditor), within scope. */
export async function fundTotals(scopeCondition?: SQL<unknown>): Promise<FundTotalRow[]> {
  const db = await getDb();
  return db
    .select({
      fundTypeId: fundLedger.fundTypeId,
      members: sql<number>`count(DISTINCT ${fundLedger.employeeId})::int`,
      employeeSum: sql<string>`sum(${fundLedger.employeeAmount})::text`,
      employerSum: sql<string>`sum(${fundLedger.employerAmount})::text`,
    })
    .from(fundLedger)
    .innerJoin(employees, eq(fundLedger.employeeId, employees.id))
    .where(scopeCondition)
    .groupBy(fundLedger.fundTypeId);
}

/** Active employees with the basic salary percent-mode contributions read. */
export async function contributionEmployees(): Promise<{ id: string; basicSalary: string | null }[]> {
  const db = await getDb();
  return db.select({ id: employees.id, basicSalary: employees.basicSalary }).from(employees).where(eq(employees.status, 'Active'));
}

/**
 * The month's posted contributions per employee (4.8a: the payslip deducts the
 * employee share). Lines are matched by their `contrib:<code>:<year>-<month>` ref.
 */
export async function contributionsForMonth(employeeIds: string[], bsYear: number, bsMonth: number): Promise<Map<string, { code: string; name: string; employeeAmount: string; employerAmount: string }[]>> {
  const out = new Map<string, { code: string; name: string; employeeAmount: string; employerAmount: string }[]>();
  if (!employeeIds.length) return out;
  const suffix = `:${bsYear}-${String(bsMonth).padStart(2, '0')}`;
  const rows = await (await getDb())
    .select({ employeeId: fundLedger.employeeId, code: fundTypes.code, name: fundTypes.name, employeeAmount: fundLedger.employeeAmount, employerAmount: fundLedger.employerAmount, ref: fundLedger.ref })
    .from(fundLedger)
    .innerJoin(fundTypes, eq(fundLedger.fundTypeId, fundTypes.id))
    .where(and(inArray(fundLedger.employeeId, employeeIds), eq(fundLedger.kind, 'contribution'), like(fundLedger.ref, `contrib:%${suffix}`)));
  for (const r of rows) {
    if (!r.ref.endsWith(suffix)) continue;
    out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), { code: r.code, name: r.name, employeeAmount: String(r.employeeAmount), employerAmount: String(r.employerAmount) }]);
  }
  return out;
}

/** Whether the company has any active fund (pre-flight: contributions expected). */
export async function hasActiveFunds(): Promise<boolean> {
  const [row] = await (await getDb()).select({ id: fundTypes.id }).from(fundTypes).where(eq(fundTypes.isActive, true)).limit(1);
  return !!row;
}
