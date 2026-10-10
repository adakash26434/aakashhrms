import { getDb } from '@/lib/db';
import { branches, designations, employeeEvents, employees, evaluationCycles, evaluations, hrCases, systemConfig, trainingParticipants, trainingPrograms } from '@/lib/db/schema';
import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';

// Promotion score: Drizzle queries only — the plain facts the engine ranks.
// Every employee read carries the caller's scope; disciplinary facts are a
// count, never case text.

export interface CandidateBase {
  id: string;
  fullName: string;
  employeeCode: string;
  designationId: string;
  designation: string;
  branch: string;
  joiningDate: string;
}

export async function activeEmployees(scopeCondition?: SQL<unknown>): Promise<CandidateBase[]> {
  const db = await getDb();
  return db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      designationId: employees.designationId,
      designation: designations.name,
      branch: branches.name,
      joiningDate: employees.joiningDate,
    })
    .from(employees)
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(and(eq(employees.status, 'Active'), scopeCondition))
    .orderBy(asc(designations.name), asc(employees.fullName));
}

/** Final evaluation totals per employee, newest cycle first. */
export async function finalTotals(employeeIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ employeeId: evaluations.employeeId, totals: evaluations.totals, openedAt: evaluationCycles.openedAt })
    .from(evaluations)
    .innerJoin(evaluationCycles, eq(evaluations.cycleId, evaluationCycles.id))
    .where(and(eq(evaluations.status, 'final'), inArray(evaluations.employeeId, employeeIds)))
    .orderBy(desc(evaluationCycles.openedAt));
  for (const r of rows) {
    const total = Number((r.totals as { total?: unknown })?.total);
    if (!Number.isFinite(total)) continue;
    out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), total]);
  }
  return out;
}

/** The latest applied promotion date per employee (seniority in the current post starts there). */
export async function lastPromotionDates(employeeIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ employeeId: employeeEvents.employeeId, last: sql<string>`max(${employeeEvents.effectiveDateAd})` })
    .from(employeeEvents)
    .where(and(eq(employeeEvents.kind, 'promotion'), eq(employeeEvents.status, 'applied'), inArray(employeeEvents.employeeId, employeeIds)))
    .groupBy(employeeEvents.employeeId);
  for (const r of rows) if (r.last) out.set(r.employeeId, String(r.last).slice(0, 10));
  return out;
}

export async function completedTrainingHours(employeeIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ employeeId: trainingParticipants.employeeId, hours: sql<string>`COALESCE(sum(${trainingPrograms.hours}), 0)::text` })
    .from(trainingParticipants)
    .innerJoin(trainingPrograms, eq(trainingParticipants.programId, trainingPrograms.id))
    .where(and(eq(trainingParticipants.status, 'completed'), inArray(trainingParticipants.employeeId, employeeIds)))
    .groupBy(trainingParticipants.employeeId);
  for (const r of rows) out.set(r.employeeId, Number(r.hours));
  return out;
}

/** Disciplinary outcomes other than "no action" decided on or after `sinceAd` — a count only. */
export async function disciplinaryOutcomes(employeeIds: string[], sinceAd: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!employeeIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ employeeId: hrCases.employeeId, n: sql<number>`count(*)::int` })
    .from(hrCases)
    .where(
      and(
        eq(hrCases.category, 'disciplinary'),
        inArray(hrCases.status, ['decided', 'closed']),
        sql`${hrCases.outcome} IS NOT NULL AND ${hrCases.outcome} <> 'no_action'`,
        gte(sql`${hrCases.decidedAt}::date`, sinceAd),
        inArray(hrCases.employeeId, employeeIds),
      ),
    )
    .groupBy(hrCases.employeeId);
  for (const r of rows) out.set(r.employeeId, r.n);
  return out;
}

export async function readWeights(): Promise<unknown> {
  const db = await getDb();
  const [row] = await db.select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, 'promotion.weights')).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function writeWeights(value: unknown): Promise<void> {
  const db = await getDb();
  const text = JSON.stringify(value);
  await db
    .insert(systemConfig)
    .values({ key: 'promotion.weights', value: text, dataType: 'json' })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: text, updatedAt: new Date() } });
}
