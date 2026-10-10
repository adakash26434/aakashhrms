import { getDb } from '@/lib/db';
import { fundLedger, fundTypes, payHeads, payrollArrears, payrollRuns, payrollSlips, travelClaims } from '@/lib/db/schema';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

// Payroll feeds (4.8): what other modules hand the pay run — approved TA-DA
// claims (paid through the run, then settled) and the month's welfare-fund
// employee contributions (deducted). Drizzle queries only; the engine still
// does all the pay maths — these are one-off head amounts.

export const TADA_HEAD_CODE = 'TADA';
export const WELFARE_FUND_HEAD_CODE = 'WELFARE_FUND';
export const ARREARS_HEAD_CODE = 'ARREARS';

/** Approved, unsettled claims whose trip ended on or before the period end, summed per employee. */
export async function approvedClaimsByEmployee(employeeIds: string[], periodEndAd: string): Promise<Map<string, { ids: string[]; payable: string }>> {
  const out = new Map<string, { ids: string[]; payable: string }>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ id: travelClaims.id, employeeId: travelClaims.employeeId, payable: travelClaims.payable })
    .from(travelClaims)
    .where(and(eq(travelClaims.status, 'approved'), isNull(travelClaims.payrollRunId), lte(travelClaims.endAd, periodEndAd), inArray(travelClaims.employeeId, employeeIds)));
  for (const r of rows) {
    const cur = out.get(r.employeeId) ?? { ids: [], payable: '0' };
    cur.ids.push(r.id);
    cur.payable = (Math.round((Number(cur.payable) + Number(r.payable)) * 100) / 100).toFixed(2);
    out.set(r.employeeId, cur);
  }
  return out;
}

/** Claim-first: only approved, unpaid claims are attached to the run and marked settled. */
export async function settleClaimsThroughRun(claimIds: string[], runId: string): Promise<number> {
  if (!claimIds.length) return 0;
  const db = await getDb();
  const rows = await db
    .update(travelClaims)
    .set({ status: 'settled', settledAt: new Date(), payrollRunId: runId })
    .where(and(inArray(travelClaims.id, claimIds), eq(travelClaims.status, 'approved'), isNull(travelClaims.payrollRunId)))
    .returning({ id: travelClaims.id });
  return rows.length;
}

/** A deleted draft run gives its claims back (approved again, unpaid). */
export async function releaseClaimsOfRun(runId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .update(travelClaims)
    .set({ status: 'approved', settledAt: null, payrollRunId: null })
    .where(and(eq(travelClaims.payrollRunId, runId), eq(travelClaims.status, 'settled')))
    .returning({ id: travelClaims.id });
  return rows.length;
}

/** The employee share of this BS month's fund contributions (ref contrib:<code>:<yyyy>-<mm>), per employee. */
export async function fundContributionsByEmployee(employeeIds: string[], bsYear: number, bsMonth: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const suffix = `:${bsYear}-${String(bsMonth).padStart(2, '0')}`;
  const rows = await db
    .select({ employeeId: fundLedger.employeeId, amount: sql<string>`COALESCE(sum(${fundLedger.employeeAmount}), 0)::text` })
    .from(fundLedger)
    .innerJoin(fundTypes, eq(fundLedger.fundTypeId, fundTypes.id))
    .where(and(eq(fundLedger.kind, 'contribution'), sql`${fundLedger.ref} = 'contrib:' || ${fundTypes.code} || ${suffix}`, inArray(fundLedger.employeeId, employeeIds)))
    .groupBy(fundLedger.employeeId);
  for (const r of rows) if (Number(r.amount) > 0) out.set(r.employeeId, Number(r.amount).toFixed(2));
  return out;
}

export async function feedHeads(): Promise<{ tada: typeof payHeads.$inferSelect | null; welfare: typeof payHeads.$inferSelect | null; arrears: typeof payHeads.$inferSelect | null }> {
  const db = await getDb();
  const rows = await db.select().from(payHeads).where(inArray(payHeads.code, [TADA_HEAD_CODE, WELFARE_FUND_HEAD_CODE, ARREARS_HEAD_CODE]));
  return { tada: rows.find((r) => r.code === TADA_HEAD_CODE) ?? null, welfare: rows.find((r) => r.code === WELFARE_FUND_HEAD_CODE) ?? null, arrears: rows.find((r) => r.code === ARREARS_HEAD_CODE) ?? null };
}

export interface PaidMonthFact {
  employeeId: string;
  runId: string;
  periodEnd: string;
  /** basic + grade on the payslip. */
  paid: number;
  /** Arrears already paid for this month in earlier runs. */
  alreadyPaid: number;
}

/**
 * Payslips of approved / locked runs that ended before `beforeStart` (YYYY-MM-DD), with the
 * arrears already paid for each. Held slips count: the pay was calculated, only its release waits.
 */
export async function paidMonths(employeeIds: string[], beforeStart: string): Promise<PaidMonthFact[]> {
  if (!employeeIds.length) return [];
  const db = await getDb();
  const slips = await db
    .select({
      employeeId: payrollSlips.employeeId,
      runId: payrollRuns.id,
      periodEnd: payrollRuns.payPeriodEndDate,
      basic: payrollSlips.basicSalary,
      grade: payrollSlips.gradeAmount,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    // F6: only the regular salary pays basic + grade; off-cycle slips (festival, arrears) carry none.
    .where(and(inArray(payrollRuns.status, ['APPROVED', 'LOCKED']), eq(payrollRuns.runType, 'REGULAR'), sql`${payrollRuns.payPeriodEndDate} < ${beforeStart}::date`, inArray(payrollSlips.employeeId, employeeIds)));
  if (!slips.length) return [];
  const prior = await db
    .select({ employeeId: payrollArrears.employeeId, sourceRunId: payrollArrears.sourceRunId, amount: sql<string>`sum(${payrollArrears.amount})::text` })
    .from(payrollArrears)
    .where(inArray(payrollArrears.employeeId, employeeIds))
    .groupBy(payrollArrears.employeeId, payrollArrears.sourceRunId);
  const already = new Map(prior.map((r) => [`${r.employeeId}|${r.sourceRunId}`, Number(r.amount)]));
  return slips.map((r) => ({
    employeeId: r.employeeId,
    runId: r.runId,
    periodEnd: String(r.periodEnd).slice(0, 10),
    paid: Number(r.basic) + Number(r.grade),
    alreadyPaid: already.get(`${r.employeeId}|${r.runId}`) ?? 0,
  }));
}

/** Records what this run pays as arrears (idempotent per employee, source run and paying run). */
export async function settleArrears(runId: string, rows: { employeeId: string; sourceRunId: string; amount: number }[]): Promise<number> {
  if (!rows.length) return 0;
  const db = await getDb();
  const inserted = await db
    .insert(payrollArrears)
    .values(rows.map((r) => ({ employeeId: r.employeeId, sourceRunId: r.sourceRunId, payrollRunId: runId, amount: r.amount.toFixed(2) })))
    .onConflictDoNothing()
    .returning({ id: payrollArrears.id });
  return inserted.length;
}
