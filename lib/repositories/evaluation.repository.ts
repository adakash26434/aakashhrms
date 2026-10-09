import { getDb } from '@/lib/db';
import { branches, designations, employees, evaluationCycles, evaluationScores, evaluationTemplates, evaluations, fiscalYears, users } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

// Performance evaluation (G1): Drizzle queries only. The rules live in
// lib/engines/evaluation.engine.ts; orchestration in
// lib/services/evaluation.service.ts.

export type EvaluationRow = typeof evaluations.$inferSelect;
export type CycleRow = typeof evaluationCycles.$inferSelect;
export type TemplateRow = typeof evaluationTemplates.$inferSelect;
export type ScoreRow = typeof evaluationScores.$inferSelect;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export async function findTemplate(code: string): Promise<TemplateRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(evaluationTemplates).where(eq(evaluationTemplates.code, code)).limit(1);
  return row ?? null;
}

export async function insertTemplate(data: { code: string; name: string; nameNp: string; form: Record<string, unknown>; isSystem: boolean }): Promise<void> {
  const db = await getDb();
  await db.insert(evaluationTemplates).values(data).onConflictDoNothing({ target: evaluationTemplates.code });
}

export async function updateTemplateForm(id: string, data: { name: string; nameNp: string; form: Record<string, unknown> }, userId: string): Promise<void> {
  const db = await getDb();
  await db.update(evaluationTemplates).set({ ...data, updatedBy: userId }).where(eq(evaluationTemplates.id, id));
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

export interface CycleJoinedRow extends CycleRow {
  fiscalYearLabel: string;
  openedByName: string | null;
  evaluationCount: number;
  finalCount: number;
}

export async function listCycles(): Promise<CycleJoinedRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      cycle: evaluationCycles,
      fiscalYearLabel: fiscalYears.label,
      openedByName: users.name,
      evaluationCount: sql<number>`(SELECT count(*)::int FROM ${evaluations} e WHERE e."cycle_id" = ${evaluationCycles.id})`,
      finalCount: sql<number>`(SELECT count(*)::int FROM ${evaluations} e WHERE e."cycle_id" = ${evaluationCycles.id} AND e."status" = 'final')`,
    })
    .from(evaluationCycles)
    .innerJoin(fiscalYears, eq(evaluationCycles.fiscalYearId, fiscalYears.id))
    .leftJoin(users, eq(evaluationCycles.openedBy, users.id))
    .orderBy(desc(evaluationCycles.openedAt));
  return rows.map((r) => ({ ...r.cycle, fiscalYearLabel: r.fiscalYearLabel, openedByName: r.openedByName, evaluationCount: r.evaluationCount, finalCount: r.finalCount }));
}

export async function findCycle(id: string): Promise<CycleRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(evaluationCycles).where(eq(evaluationCycles.id, id)).limit(1);
  return row ?? null;
}

export async function insertCycle(data: { fiscalYearId: string; label: string; period: string; openedBy: string }): Promise<CycleRow> {
  const db = await getDb();
  const [row] = await db.insert(evaluationCycles).values(data).returning();
  return row;
}

export async function closeCycle(id: string, userId: string): Promise<CycleRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(evaluationCycles)
    .set({ status: 'closed', closedBy: userId, closedAt: new Date() })
    .where(and(eq(evaluationCycles.id, id), eq(evaluationCycles.status, 'open')))
    .returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export interface EvaluationJoinedRow extends EvaluationRow {
  employeeName: string;
  employeeCode: string;
  designation: string;
  branch: string;
  cycleLabel: string;
  cycleStatus: string;
}

const joinedSelect = {
  evaluation: evaluations,
  employeeName: employees.fullName,
  employeeCode: employees.employeeCode,
  designation: designations.name,
  branch: branches.name,
  cycleLabel: evaluationCycles.label,
  cycleStatus: evaluationCycles.status,
};

const flatten = (r: { evaluation: EvaluationRow; employeeName: string; employeeCode: string; designation: string; branch: string; cycleLabel: string; cycleStatus: string }): EvaluationJoinedRow => ({
  ...r.evaluation,
  employeeName: r.employeeName,
  employeeCode: r.employeeCode,
  designation: r.designation,
  branch: r.branch,
  cycleLabel: r.cycleLabel,
  cycleStatus: r.cycleStatus,
});

export interface EvaluationFilter {
  cycleId?: string;
  status?: string;
  employeeId?: string;
}

export async function listEvaluations(filter: EvaluationFilter, scopeCondition?: SQL<unknown>): Promise<EvaluationJoinedRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (scopeCondition) conditions.push(scopeCondition);
  if (filter.cycleId) conditions.push(eq(evaluations.cycleId, filter.cycleId));
  if (filter.status) conditions.push(eq(evaluations.status, filter.status));
  if (filter.employeeId) conditions.push(eq(evaluations.employeeId, filter.employeeId));
  const rows = await db
    .select(joinedSelect)
    .from(evaluations)
    .innerJoin(employees, eq(evaluations.employeeId, employees.id))
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .innerJoin(evaluationCycles, eq(evaluations.cycleId, evaluationCycles.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(evaluations.startedAt))
    .limit(1000);
  return rows.map(flatten);
}

export async function findEvaluation(id: string, scopeCondition?: SQL<unknown>): Promise<EvaluationJoinedRow | null> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(evaluations.id, id), scopeCondition) : eq(evaluations.id, id);
  const rows = await db
    .select(joinedSelect)
    .from(evaluations)
    .innerJoin(employees, eq(evaluations.employeeId, employees.id))
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .innerJoin(evaluationCycles, eq(evaluations.cycleId, evaluationCycles.id))
    .where(where)
    .limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

export interface StartWrite {
  cycleId: string;
  employeeId: string;
  form: Record<string, unknown>;
  raters: Record<string, string>;
  stage: string;
  startedBy: string;
}

/** Starts evaluations; employees already in the cycle are skipped (unique key). */
export async function startEvaluations(writes: StartWrite[]): Promise<number> {
  const db = await getDb();
  let started = 0;
  for (const w of writes) {
    const inserted = await db.insert(evaluations).values(w).onConflictDoNothing({ target: [evaluations.cycleId, evaluations.employeeId] }).returning({ id: evaluations.id });
    started += inserted.length;
  }
  return started;
}

export async function findScores(evaluationId: string): Promise<ScoreRow[]> {
  const db = await getDb();
  return db.select().from(evaluationScores).where(eq(evaluationScores.evaluationId, evaluationId)).orderBy(asc(evaluationScores.stage), asc(evaluationScores.criterionId));
}

export interface StageMarksWrite {
  evaluationId: string;
  stage: string;
  marks: { criterionId: string; marks: string; note: string | null }[];
  ratedBy: string;
  /** The stage that follows, or 'final'. */
  nextStage: string;
  /** Totals once the evaluation just became final, else null. */
  totals: Record<string, unknown> | null;
}

/**
 * Saves one stage's marks and advances the evaluation in a single transaction.
 * The evaluation row is claimed on its current stage, so a stale window
 * (someone else already advanced it) changes nothing.
 */
export async function saveStageTx(write: StageMarksWrite): Promise<'saved' | 'stale'> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(evaluations)
      .set(
        write.totals
          ? { stage: write.nextStage, status: 'final', totals: write.totals, finalizedBy: write.ratedBy, finalizedAt: new Date() }
          : { stage: write.nextStage },
      )
      .where(and(eq(evaluations.id, write.evaluationId), eq(evaluations.stage, write.stage), eq(evaluations.status, 'in_progress')))
      .returning({ id: evaluations.id });
    if (!claimed) return 'stale';
    for (const m of write.marks) {
      await tx
        .insert(evaluationScores)
        .values({ evaluationId: write.evaluationId, stage: write.stage, criterionId: m.criterionId, marks: m.marks, note: m.note, ratedBy: write.ratedBy })
        .onConflictDoUpdate({
          target: [evaluationScores.evaluationId, evaluationScores.stage, evaluationScores.criterionId],
          set: { marks: m.marks, note: m.note, ratedBy: write.ratedBy, ratedAt: new Date() },
        });
    }
    return 'saved';
  });
}

/** How many in-progress evaluations wait for this user's stage, within scope. */
export async function countWaitingFor(userId: string, scopeCondition?: SQL<unknown>): Promise<number> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [
    eq(evaluations.status, 'in_progress'),
    sql`${evaluations.raters} ->> ${evaluations.stage} = ${userId}`,
  ];
  if (scopeCondition) conditions.push(scopeCondition);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(evaluations)
    .innerJoin(employees, eq(evaluations.employeeId, employees.id))
    .where(and(...conditions));
  return row?.n ?? 0;
}

/** Active employees in scope who are not yet in this cycle. */
export async function employeesNotInCycle(cycleId: string, scopeCondition?: SQL<unknown>): Promise<{ id: string; userId: string | null; supervisorId: string | null }[]> {
  const db = await getDb();
  const inCycle = db.select({ id: evaluations.employeeId }).from(evaluations).where(eq(evaluations.cycleId, cycleId));
  const conditions: SQL<unknown>[] = [eq(employees.status, 'Active'), sql`${employees.id} NOT IN (${inCycle})`];
  if (scopeCondition) conditions.push(scopeCondition);
  const rows = await db
    .select({ id: employees.id, userId: users.id, supervisorId: employees.supervisorId })
    .from(employees)
    .leftJoin(users, eq(users.employeeId, employees.id))
    .where(and(...conditions));
  return rows;
}

/** The user account linked to each of these employees (subject users never rate themselves). */
export async function userIdsForEmployees(employeeIds: string[]): Promise<Map<string, string>> {
  if (!employeeIds.length) return new Map();
  const db = await getDb();
  const rows = await db.select({ employeeId: users.employeeId, id: users.id }).from(users).where(inArray(users.employeeId, employeeIds));
  const map = new Map<string, string>();
  for (const r of rows) if (r.employeeId) map.set(r.employeeId, r.id);
  return map;
}

/** Display names for rater user ids. */
export async function userNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.name || r.email || r.id]));
}

/** Users who can be chosen as raters (active, linked name or email). */
export async function raterOptions(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name));
  return rows.map((r) => ({ id: r.id, name: r.name || r.email || r.id }));
}
