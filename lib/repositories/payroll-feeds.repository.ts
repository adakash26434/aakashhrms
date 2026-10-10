import { getDb } from '@/lib/db';
import { fundLedger, fundTypes, leaveSalaryRuns, payHeads, payrollArrears, payrollRuns, payrollSlips, reimbursementClaims, travelClaims } from '@/lib/db/schema';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

// Payroll feeds (4.8): what other modules hand the pay run — approved TA-DA
// claims (paid through the run, then settled) and the month's welfare-fund
// employee contributions (deducted). Drizzle queries only; the engine still
// does all the pay maths — these are one-off head amounts.

import { ARREARS_HEAD_CODE, LEAVE_ENCASH_HEAD_CODE, REIMBURSE_HEAD_CODE, REIMBURSE_TAXABLE_HEAD_CODE, TADA_HEAD_CODE, WELFARE_FUND_HEAD_CODE } from '@/lib/constants/payroll-feeds';

export { ARREARS_HEAD_CODE, TADA_HEAD_CODE, WELFARE_FUND_HEAD_CODE };

/** A transaction, so the run or payslip and what it settles commit together. */
export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];

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

/**
 * Claim-first: only approved, unpaid claims are attached to the run and marked settled. Run it in
 * the transaction that creates the run's payslips and compare the count: a claim that changed
 * meanwhile must not be paid on a payslip without being settled.
 */
export async function settleClaimsThroughRun(claimIds: string[], runId: string, tx?: Tx): Promise<number> {
  if (!claimIds.length) return 0;
  const db = tx ?? (await getDb());
  const rows = await db
    .update(travelClaims)
    .set({ status: 'settled', settledAt: new Date(), payrollRunId: runId })
    .where(and(inArray(travelClaims.id, claimIds), eq(travelClaims.status, 'approved'), isNull(travelClaims.payrollRunId)))
    .returning({ id: travelClaims.id });
  return rows.length;
}

/** A deleted draft run (or one employee's deleted payslip) gives its claims back: approved again, unpaid. */
export async function releaseClaimsOfRun(runId: string, opts: { employeeId?: string; tx?: Tx } = {}): Promise<number> {
  const db = opts.tx ?? (await getDb());
  const rows = await db
    .update(travelClaims)
    .set({ status: 'approved', settledAt: null, payrollRunId: null })
    .where(and(eq(travelClaims.payrollRunId, runId), eq(travelClaims.status, 'settled'), opts.employeeId ? eq(travelClaims.employeeId, opts.employeeId) : undefined))
    .returning({ id: travelClaims.id });
  return rows.length;
}

/** F16: approved, unpaid reimbursements whose bill is dated by the period end, per employee and taxability. */
export async function approvedReimbursementsByEmployee(employeeIds: string[], periodEndAd: string): Promise<Map<string, { freeIds: string[]; taxableIds: string[]; free: string; taxable: string }>> {
  const out = new Map<string, { freeIds: string[]; taxableIds: string[]; free: string; taxable: string }>();
  if (!employeeIds.length) return out;
  const rows = await (await getDb())
    .select({ id: reimbursementClaims.id, employeeId: reimbursementClaims.employeeId, amount: reimbursementClaims.amount, taxable: reimbursementClaims.taxable })
    .from(reimbursementClaims)
    .where(and(eq(reimbursementClaims.status, 'approved'), isNull(reimbursementClaims.payrollRunId), lte(reimbursementClaims.expenseDate, periodEndAd), inArray(reimbursementClaims.employeeId, employeeIds)));
  for (const r of rows) {
    const cur = out.get(r.employeeId) ?? { freeIds: [], taxableIds: [], free: '0.00', taxable: '0.00' };
    (r.taxable ? cur.taxableIds : cur.freeIds).push(r.id);
    const key = r.taxable ? 'taxable' : 'free';
    cur[key] = (Math.round(Number(cur[key]) * 100 + Number(r.amount) * 100) / 100).toFixed(2);
    out.set(r.employeeId, cur);
  }
  return out;
}

/** Claim-first, inside the run's transaction (as for TA-DA claims): approved, unpaid reimbursements only. */
export async function settleReimbursementsThroughRun(ids: string[], runId: string, tx?: Tx): Promise<number> {
  if (!ids.length) return 0;
  const rows = await (tx ?? (await getDb()))
    .update(reimbursementClaims)
    .set({ status: 'settled', settledAt: new Date(), payrollRunId: runId })
    .where(and(inArray(reimbursementClaims.id, ids), eq(reimbursementClaims.status, 'approved'), isNull(reimbursementClaims.payrollRunId)))
    .returning({ id: reimbursementClaims.id });
  return rows.length;
}

/** A deleted draft run (or one employee's deleted payslip) gives its reimbursements back: approved, unpaid. */
export async function releaseReimbursementsOfRun(runId: string, opts: { employeeId?: string; tx?: Tx } = {}): Promise<number> {
  const rows = await (opts.tx ?? (await getDb()))
    .update(reimbursementClaims)
    .set({ status: 'approved', settledAt: null, payrollRunId: null })
    .where(and(eq(reimbursementClaims.payrollRunId, runId), eq(reimbursementClaims.status, 'settled'), opts.employeeId ? eq(reimbursementClaims.employeeId, opts.employeeId) : undefined))
    .returning({ id: reimbursementClaims.id });
  return rows.length;
}

/**
 * 4.9: approved, unpaid leave salary whose pay month is this run's or earlier (a record waits for
 * the next regular run once its month's run is final), per employee.
 */
export async function approvedLeaveSalaryByEmployee(employeeIds: string[], runPayMonth: string): Promise<Map<string, { ids: string[]; amount: string }>> {
  const out = new Map<string, { ids: string[]; amount: string }>();
  if (!employeeIds.length) return out;
  const rows = await (await getDb())
    .select({ id: leaveSalaryRuns.id, employeeId: leaveSalaryRuns.employeeId, amount: leaveSalaryRuns.totalAmount })
    .from(leaveSalaryRuns)
    .where(
      and(
        eq(leaveSalaryRuns.status, 'APPROVED'),
        isNull(leaveSalaryRuns.payrollRunId),
        sql`${leaveSalaryRuns.paymentPeriod} ~ '^[0-9]{4}-[0-9]{2}$'`,
        lte(leaveSalaryRuns.paymentPeriod, runPayMonth),
        inArray(leaveSalaryRuns.employeeId, employeeIds)
      )
    );
  for (const r of rows) {
    const cur = out.get(r.employeeId) ?? { ids: [], amount: '0.00' };
    cur.ids.push(r.id);
    cur.amount = (Math.round(Number(cur.amount) * 100 + Number(r.amount) * 100) / 100).toFixed(2);
    out.set(r.employeeId, cur);
  }
  return out;
}

/** Claim-first, inside the run's transaction: approved, unpaid leave salary only. */
export async function settleLeaveSalaryThroughRun(ids: string[], runId: string, tx?: Tx): Promise<number> {
  if (!ids.length) return 0;
  const rows = await (tx ?? (await getDb()))
    .update(leaveSalaryRuns)
    .set({ status: 'PAID', settledAt: new Date(), payrollRunId: runId, updatedAt: new Date() })
    .where(and(inArray(leaveSalaryRuns.id, ids), eq(leaveSalaryRuns.status, 'APPROVED'), isNull(leaveSalaryRuns.payrollRunId)))
    .returning({ id: leaveSalaryRuns.id });
  return rows.length;
}

/** A deleted draft run (or one employee's deleted payslip) gives its leave salary back: approved, unpaid. */
export async function releaseLeaveSalaryOfRun(runId: string, opts: { employeeId?: string; tx?: Tx } = {}): Promise<number> {
  const rows = await (opts.tx ?? (await getDb()))
    .update(leaveSalaryRuns)
    .set({ status: 'APPROVED', settledAt: null, payrollRunId: null, updatedAt: new Date() })
    .where(and(eq(leaveSalaryRuns.payrollRunId, runId), eq(leaveSalaryRuns.status, 'PAID'), opts.employeeId ? eq(leaveSalaryRuns.employeeId, opts.employeeId) : undefined))
    .returning({ id: leaveSalaryRuns.id });
  return rows.length;
}

/** One employee's deleted payslip gives back the arrears it paid (the run's other payslips keep theirs). */
export async function releaseArrearsOfRun(runId: string, employeeId: string, tx?: Tx): Promise<number> {
  const db = tx ?? (await getDb());
  const rows = await db
    .delete(payrollArrears)
    .where(and(eq(payrollArrears.payrollRunId, runId), eq(payrollArrears.employeeId, employeeId)))
    .returning({ id: payrollArrears.id });
  return rows.length;
}

/** What a run already pays an employee through its feeds (recalculating the payslip keeps these lines). */
export async function paidThroughRun(runId: string, employeeId: string): Promise<{ tada: string; arrears: string; reimburse: string; reimburseTaxable: string; leaveEncash: string }> {
  const db = await getDb();
  const [[claims], [arrears], [reimbursed], [leaveSalary]] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(sum(${travelClaims.payable}), 0)::text`, n: sql<number>`count(*)::int` })
      .from(travelClaims)
      .where(and(eq(travelClaims.payrollRunId, runId), eq(travelClaims.employeeId, employeeId), eq(travelClaims.status, 'settled'))),
    db
      .select({ total: sql<string>`COALESCE(sum(${payrollArrears.amount}), 0)::text` })
      .from(payrollArrears)
      .where(and(eq(payrollArrears.payrollRunId, runId), eq(payrollArrears.employeeId, employeeId))),
    db
      .select({
        free: sql<string>`COALESCE(sum(${reimbursementClaims.amount}) FILTER (WHERE NOT ${reimbursementClaims.taxable}), 0)::text`,
        taxable: sql<string>`COALESCE(sum(${reimbursementClaims.amount}) FILTER (WHERE ${reimbursementClaims.taxable}), 0)::text`,
      })
      .from(reimbursementClaims)
      .where(and(eq(reimbursementClaims.payrollRunId, runId), eq(reimbursementClaims.employeeId, employeeId), eq(reimbursementClaims.status, 'settled'))),
    db
      .select({ total: sql<string>`COALESCE(sum(${leaveSalaryRuns.totalAmount}), 0)::text` })
      .from(leaveSalaryRuns)
      .where(and(eq(leaveSalaryRuns.payrollRunId, runId), eq(leaveSalaryRuns.employeeId, employeeId), eq(leaveSalaryRuns.status, 'PAID'))),
  ]);
  return {
    tada: claims.n ? Number(claims.total).toFixed(2) : '0.00',
    arrears: Number(arrears.total).toFixed(2),
    reimburse: Number(reimbursed.free).toFixed(2),
    reimburseTaxable: Number(reimbursed.taxable).toFixed(2),
    leaveEncash: Number(leaveSalary.total).toFixed(2),
  };
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

type PayHeadRow = typeof payHeads.$inferSelect;

export async function feedHeads(): Promise<{ tada: PayHeadRow | null; welfare: PayHeadRow | null; arrears: PayHeadRow | null; reimburse: PayHeadRow | null; reimburseTaxable: PayHeadRow | null; leaveEncash: PayHeadRow | null }> {
  const db = await getDb();
  const rows = await db.select().from(payHeads).where(inArray(payHeads.code, [TADA_HEAD_CODE, WELFARE_FUND_HEAD_CODE, ARREARS_HEAD_CODE, REIMBURSE_HEAD_CODE, REIMBURSE_TAXABLE_HEAD_CODE, LEAVE_ENCASH_HEAD_CODE]));
  const head = (code: string) => rows.find((r) => r.code === code) ?? null;
  return {
    tada: head(TADA_HEAD_CODE),
    welfare: head(WELFARE_FUND_HEAD_CODE),
    arrears: head(ARREARS_HEAD_CODE),
    reimburse: head(REIMBURSE_HEAD_CODE),
    reimburseTaxable: head(REIMBURSE_TAXABLE_HEAD_CODE),
    leaveEncash: head(LEAVE_ENCASH_HEAD_CODE),
  };
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
export async function settleArrears(runId: string, rows: { employeeId: string; sourceRunId: string; amount: number }[], tx?: Tx): Promise<number> {
  if (!rows.length) return 0;
  const db = tx ?? (await getDb());
  const inserted = await db
    .insert(payrollArrears)
    .values(rows.map((r) => ({ employeeId: r.employeeId, sourceRunId: r.sourceRunId, payrollRunId: runId, amount: r.amount.toFixed(2) })))
    .onConflictDoNothing()
    .returning({ id: payrollArrears.id });
  return inserted.length;
}
