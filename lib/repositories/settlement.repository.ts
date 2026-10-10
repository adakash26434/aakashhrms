import { getDb } from '@/lib/db';
import { employees, exitSettlements, fiscalYears, payrollRuns, payrollSlips } from '@/lib/db/schema';
import { and, eq, lte, gte, sql } from 'drizzle-orm';

// Full & final settlement (4.8 / F8): Drizzle queries only. Rules live in
// lib/engines/settlement.engine.ts; orchestration in lib/services/settlement.service.ts.

export type SettlementRow = typeof exitSettlements.$inferSelect;
export const POLICY_KEY = 'settlement.policy';

export async function findByCase(exitCaseId: string): Promise<SettlementRow | null> {
  const [row] = await (await getDb()).select().from(exitSettlements).where(eq(exitSettlements.exitCaseId, exitCaseId)).limit(1);
  return row ?? null;
}

type Frozen = Pick<SettlementRow, 'lines' | 'earnings' | 'deductions' | 'net' | 'taxSheet' | 'policy'>;

/** Creates the draft, or prepares it again while it is still a draft. Approved / paid rows are never touched. */
export async function saveDraft(exitCaseId: string, employeeId: string, frozen: Frozen, preparedBy: string): Promise<SettlementRow | null> {
  const db = await getDb();
  const [row] = await db
    .insert(exitSettlements)
    .values({ exitCaseId, employeeId, status: 'draft', ...frozen, preparedBy })
    .onConflictDoUpdate({
      target: exitSettlements.exitCaseId,
      set: { ...frozen, preparedBy, preparedAt: new Date() },
      setWhere: eq(exitSettlements.status, 'draft'),
    })
    .returning();
  return row ?? null;
}

/** Claim-first status move: succeeds only while the row is still in `from`. */
export async function claim(
  id: string,
  from: 'draft' | 'approved',
  to: 'approved' | 'paid',
  userId: string,
  paymentRef: string | null,
): Promise<SettlementRow | null> {
  const now = new Date();
  const set =
    to === 'approved'
      ? { status: to, approvedBy: userId, approvedAt: now }
      : { status: to, paidBy: userId, paidAt: now, paymentRef };
  const [row] = await (await getDb())
    .update(exitSettlements)
    .set(set)
    .where(and(eq(exitSettlements.id, id), eq(exitSettlements.status, from)))
    .returning();
  return row ?? null;
}

/** Pay months (BS) the employee already has a regular payslip for, in any run state (an off-cycle run, F6, pays no salary). */
export async function slipMonths(employeeId: string): Promise<{ year: number; month: number }[]> {
  const rows = await (await getDb())
    .select({ year: payrollRuns.payPeriodYear, month: payrollRuns.payPeriodMonth })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(eq(payrollSlips.employeeId, employeeId), eq(payrollRuns.runType, 'REGULAR')))
    .groupBy(payrollRuns.payPeriodYear, payrollRuns.payPeriodMonth);
  return rows;
}

export async function fiscalYearOn(dateAd: string) {
  const [row] = await (await getDb())
    .select({ id: fiscalYears.id })
    .from(fiscalYears)
    .where(and(lte(fiscalYears.startDateAD, sql`${dateAd}::timestamp`), gte(fiscalYears.endDateAD, sql`${dateAd}::timestamp`)))
    .limit(1);
  return row ?? null;
}

export async function employeeFacts(employeeId: string) {
  const [row] = await (await getDb())
    .select({
      id: employees.id,
      category: employees.category,
      gender: employees.gender,
      isDisabled: employees.isDisabled,
      taxStatus: employees.taxStatus,
      joiningDate: employees.joiningDate,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  return row ?? null;
}

/** True when any payslip of the employee deducted SSF (the 1% first-slab tax is waived for them). */
export async function paysSsf(employeeId: string): Promise<boolean> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(payrollSlips)
    .where(and(eq(payrollSlips.employeeId, employeeId), sql`${payrollSlips.ssfEmployee} > 0`));
  return (row?.n ?? 0) > 0;
}
