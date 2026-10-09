import { getDb } from '@/lib/db';
import { employees, hrCaseEvents, hrCases, users } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';

// Disciplinary & grievance (G8): Drizzle queries only. Rules live in
// lib/engines/case.engine.ts; orchestration in lib/services/case.service.ts.
// hr_case_events is APPEND-ONLY: this file has no update or delete on it.

export type CaseRow = typeof hrCases.$inferSelect;
export type CaseEventRow = typeof hrCaseEvents.$inferSelect;

export interface CaseJoinedRow extends CaseRow {
  employeeName: string;
  employeeCode: string;
  openedByName: string | null;
}

const joined = { c: hrCases, employeeName: employees.fullName, employeeCode: employees.employeeCode, openedByName: users.name };
const flatten = (r: { c: CaseRow; employeeName: string; employeeCode: string; openedByName: string | null }): CaseJoinedRow => ({
  ...r.c,
  employeeName: r.employeeName,
  employeeCode: r.employeeCode,
  openedByName: r.openedByName,
});

export async function listCases(scopeCondition?: SQL<unknown>): Promise<CaseJoinedRow[]> {
  const db = await getDb();
  const rows = await db
    .select(joined)
    .from(hrCases)
    .innerJoin(employees, eq(hrCases.employeeId, employees.id))
    .leftJoin(users, eq(hrCases.openedBy, users.id))
    .where(scopeCondition)
    .orderBy(desc(hrCases.openedAt))
    .limit(1000);
  return rows.map(flatten);
}

export async function findCase(id: string, scopeCondition?: SQL<unknown>): Promise<CaseJoinedRow | null> {
  const db = await getDb();
  const rows = await db
    .select(joined)
    .from(hrCases)
    .innerJoin(employees, eq(hrCases.employeeId, employees.id))
    .leftJoin(users, eq(hrCases.openedBy, users.id))
    .where(scopeCondition ? and(eq(hrCases.id, id), scopeCondition) : eq(hrCases.id, id))
    .limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

export interface CaseWrite {
  category: string;
  employeeId: string;
  severity: string;
  title: string;
  description: string;
  openedBy: string;
}

/** Opens a case and writes its first timeline line in one transaction. */
export async function openCaseTx(write: CaseWrite): Promise<CaseRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(hrCases).values(write).returning();
    await tx.insert(hrCaseEvents).values({ caseId: row.id, kind: 'opened', text: 'Case opened.', actorId: write.openedBy });
    return row;
  });
}

/**
 * Moves a case from `from` to `to` — claim-first: the update only matches while
 * the case is still in `from`, so two people cannot both move it. Returns false
 * when someone else got there first.
 */
export async function moveStatusTx(id: string, from: string, to: 'investigating', userId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx.update(hrCases).set({ status: to }).where(and(eq(hrCases.id, id), eq(hrCases.status, from))).returning({ id: hrCases.id });
    if (!claimed) return false;
    await tx.insert(hrCaseEvents).values({ caseId: id, kind: 'status', text: `Moved to ${to}.`, actorId: userId });
    return true;
  });
}

export async function decideTx(id: string, from: string, outcome: string, outcomeLabel: string, note: string, userId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(hrCases)
      .set({ status: 'decided', outcome, outcomeNote: note, decidedBy: userId, decidedAt: new Date() })
      .where(and(eq(hrCases.id, id), eq(hrCases.status, from)))
      .returning({ id: hrCases.id });
    if (!claimed) return false;
    await tx.insert(hrCaseEvents).values({ caseId: id, kind: 'decision', text: `Decision: ${outcomeLabel}. ${note}`, actorId: userId });
    return true;
  });
}

export async function closeTx(id: string, userId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(hrCases)
      .set({ status: 'closed', closedBy: userId, closedAt: new Date() })
      .where(and(eq(hrCases.id, id), eq(hrCases.status, 'decided')))
      .returning({ id: hrCases.id });
    if (!claimed) return false;
    await tx.insert(hrCaseEvents).values({ caseId: id, kind: 'closed', text: 'Case closed.', actorId: userId });
    return true;
  });
}

export async function addNote(caseId: string, text: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.insert(hrCaseEvents).values({ caseId, kind: 'note', text, actorId: userId });
}

export async function eventsFor(caseId: string): Promise<(CaseEventRow & { actorName: string | null })[]> {
  const db = await getDb();
  const rows = await db
    .select({ e: hrCaseEvents, actorName: users.name })
    .from(hrCaseEvents)
    .leftJoin(users, eq(hrCaseEvents.actorId, users.id))
    .where(eq(hrCaseEvents.caseId, caseId))
    .orderBy(asc(hrCaseEvents.at));
  return rows.map((r) => ({ ...r.e, actorName: r.actorName }));
}

export async function userNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.name ?? "—"]));
}
