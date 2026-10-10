import { getDb } from '@/lib/db';
import { employeeBank, employeePersonal, employees, payrollRuns, payrollSlips, payHeads, payrollVarianceAcks, systemConfig, users } from '@/lib/db/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

// Payroll controls (4.8 / F1–F3): Drizzle queries only. Rules live in
// lib/engines/payroll-control.engine.ts; orchestration in
// lib/services/payroll-control.service.ts.

export type RunRecord = typeof payrollRuns.$inferSelect;

/** Runs before this one (by pay month), newest first. */
export async function earlierRuns(run: Pick<RunRecord, 'payPeriodYear' | 'payPeriodMonth' | 'id'> & { runType?: string }, limit = 12): Promise<RunRecord[]> {
  const db = await getDb();
  const key = run.payPeriodYear * 100 + run.payPeriodMonth;
  return db
    .select()
    .from(payrollRuns)
    // F6: a run is compared with earlier runs of its own type only.
    .where(and(sql`(${payrollRuns.payPeriodYear} * 100 + ${payrollRuns.payPeriodMonth}) < ${key}`, eq(payrollRuns.runType, run.runType ?? 'REGULAR'), inArray(payrollRuns.status, ['UNDER_REVIEW', 'APPROVED', 'LOCKED'])))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth), desc(payrollRuns.generatedAt))
    .limit(limit);
}

export async function acksFor(runId: string) {
  const db = await getDb();
  return db.select().from(payrollVarianceAcks).where(eq(payrollVarianceAcks.payrollRunId, runId));
}

export async function insertAcks(runId: string, rows: { flagKey: string; employeeId: string }[], note: string, userId: string): Promise<number> {
  if (!rows.length) return 0;
  const db = await getDb();
  const inserted = await db
    .insert(payrollVarianceAcks)
    .values(rows.map((r) => ({ payrollRunId: runId, flagKey: r.flagKey, employeeId: r.employeeId, note, ackedBy: userId })))
    .onConflictDoNothing()
    .returning({ id: payrollVarianceAcks.id });
  return inserted.length;
}

/** Claim-first: publishes a locked run once. Null when it is not locked or already published. */
export async function publishRun(runId: string, userId: string): Promise<RunRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(payrollRuns)
    .set({ publishedAt: new Date(), publishedBy: userId })
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.status, 'LOCKED'), isNull(payrollRuns.publishedAt)))
    .returning();
  return row ?? null;
}

export async function holdSlip(slipId: string, reason: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(payrollSlips)
    .set({ heldAt: new Date(), heldBy: userId, holdReason: reason })
    .where(and(eq(payrollSlips.id, slipId), isNull(payrollSlips.heldAt)))
    .returning({ id: payrollSlips.id });
  return rows.length > 0;
}

export async function releaseSlip(slipId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(payrollSlips)
    .set({ heldAt: null, heldBy: null, holdReason: null })
    .where(and(eq(payrollSlips.id, slipId), sql`${payrollSlips.heldAt} IS NOT NULL`))
    .returning({ id: payrollSlips.id });
  return rows.length > 0;
}

export async function heldSlips(runId: string) {
  const db = await getDb();
  return db
    .select({ id: payrollSlips.id, employeeId: payrollSlips.employeeId, employeeName: payrollSlips.employeeName, employeeCode: payrollSlips.employeeCode, holdReason: payrollSlips.holdReason })
    .from(payrollSlips)
    .where(and(eq(payrollSlips.payrollRunId, runId), sql`${payrollSlips.heldAt} IS NOT NULL`));
}

export async function findSlipRun(slipId: string): Promise<{ slipId: string; runId: string; employeeId: string; runStatus: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ slipId: payrollSlips.id, runId: payrollSlips.payrollRunId, employeeId: payrollSlips.employeeId, runStatus: payrollRuns.status })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(eq(payrollSlips.id, slipId))
    .limit(1);
  return row ?? null;
}

export async function actorEmployeeId(userId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ employeeId: users.employeeId }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.employeeId ?? null;
}

export async function readConfig(key: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return row?.value ?? null;
}

export async function writeConfig(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(systemConfig)
    .values({ key, value, dataType: 'string' })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: new Date() } });
}

/** Pre-flight facts about people: names with codes for those missing a bank account or a PAN. */
export async function bankAndPanGaps(employeeIds: string[]): Promise<{ withoutBank: string[]; withoutPan: string[] }> {
  if (!employeeIds.length) return { withoutBank: [], withoutPan: [] };
  const db = await getDb();
  const people = await db.select({ id: employees.id, name: employees.fullName, code: employees.employeeCode }).from(employees).where(inArray(employees.id, employeeIds));
  const banks = await db
    .select({ employeeId: employeeBank.employeeId })
    .from(employeeBank)
    .where(and(inArray(employeeBank.employeeId, employeeIds), eq(employeeBank.isActive, true), sql`length(trim(${employeeBank.accountNumber})) > 0`));
  const pans = await db
    .select({ employeeId: employeePersonal.employeeId })
    .from(employeePersonal)
    .where(and(inArray(employeePersonal.employeeId, employeeIds), sql`length(trim(coalesce(${employeePersonal.panNumber}, ''))) > 0`));
  const hasBank = new Set(banks.map((b) => b.employeeId));
  const hasPan = new Set(pans.map((p) => p.employeeId));
  const label = (p: { name: string; code: string }) => `${p.name} (${p.code})`;
  return {
    withoutBank: people.filter((p) => !hasBank.has(p.id)).map(label),
    withoutPan: people.filter((p) => !hasPan.has(p.id)).map(label),
  };
}


/** Which statutory heads the pay-head master has (by flag). */
export async function statutoryHeadsPresent(): Promise<{ tds: boolean; pf: boolean; ssf: boolean; cit: boolean }> {
  const db = await getDb();
  const rows = await db.select({ tds: payHeads.isTdsHead, pf: payHeads.isPfHead, ssf: payHeads.isSsfHead, cit: payHeads.isCitHead }).from(payHeads);
  return { tds: rows.some((r) => r.tds), pf: rows.some((r) => r.pf), ssf: rows.some((r) => r.ssf), cit: rows.some((r) => r.cit) };
}
