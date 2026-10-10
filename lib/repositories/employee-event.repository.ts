import { getDb } from '@/lib/db';
import { branches, departments, designations, employeeEvents, employees, users } from '@/lib/db/schema';
import { and, desc, eq, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import type { EmployeeSnapshot } from '@/lib/engines/employee-event.engine';

// Employee lifecycle events (G2): Drizzle queries only. The rules live in
// lib/engines/employee-event.engine.ts; orchestration in
// lib/services/employee-event.service.ts.

export type EmployeeEventRow = typeof employeeEvents.$inferSelect;

export interface EventJoinedRow extends EmployeeEventRow {
  employeeName: string;
  employeeCode: string;
  createdByName: string | null;
}

/** The employee an event is about, with names resolved — only within the caller's scope. */
export async function findEmployeeSnapshot(employeeId: string, scopeCondition?: SQL<unknown>): Promise<EmployeeSnapshot | null> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(employees.id, employeeId), scopeCondition) : eq(employees.id, employeeId);
  const [row] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      designationId: employees.designationId,
      designation: designations.name,
      departmentId: employees.departmentId,
      department: departments.name,
      branchId: employees.branchId,
      branch: branches.name,
      category: employees.category,
      confirmationDate: employees.confirmationDate,
      joiningDate: employees.joiningDate,
      status: employees.status,
    })
    .from(employees)
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(where)
    .limit(1);
  return row ?? null;
}

export interface EventFilter {
  q?: string;
  kind?: string;
  status?: string;
  employeeId?: string;
}

export async function listEvents(filter: EventFilter, scopeCondition?: SQL<unknown>): Promise<EventJoinedRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (scopeCondition) conditions.push(scopeCondition);
  if (filter.kind) conditions.push(eq(employeeEvents.kind, filter.kind));
  if (filter.status) conditions.push(eq(employeeEvents.status, filter.status));
  if (filter.employeeId) conditions.push(eq(employeeEvents.employeeId, filter.employeeId));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    const match = or(ilike(employees.fullName, q), ilike(employees.employeeCode, q));
    if (match) conditions.push(match);
  }
  const rows = await db
    .select({ event: employeeEvents, employeeName: employees.fullName, employeeCode: employees.employeeCode, createdByName: users.name })
    .from(employeeEvents)
    .innerJoin(employees, eq(employeeEvents.employeeId, employees.id))
    .leftJoin(users, eq(employeeEvents.createdBy, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(employeeEvents.effectiveDateAd), desc(employeeEvents.createdAt))
    .limit(1000);
  return rows.map((r) => ({ ...r.event, employeeName: r.employeeName, employeeCode: r.employeeCode, createdByName: r.createdByName }));
}

export async function findEventById(id: string, scopeCondition?: SQL<unknown>): Promise<EventJoinedRow | null> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(employeeEvents.id, id), scopeCondition) : eq(employeeEvents.id, id);
  const rows = await db
    .select({ event: employeeEvents, employeeName: employees.fullName, employeeCode: employees.employeeCode, createdByName: users.name })
    .from(employeeEvents)
    .innerJoin(employees, eq(employeeEvents.employeeId, employees.id))
    .leftJoin(users, eq(employeeEvents.createdBy, users.id))
    .where(where)
    .limit(1);
  const r = rows[0];
  return r ? { ...r.event, employeeName: r.employeeName, employeeCode: r.employeeCode, createdByName: r.createdByName } : null;
}

export interface EventWrite {
  employeeId: string;
  kind: string;
  effectiveDateAd: string;
  effectiveDateBs: string;
  fromValues: Record<string, string>;
  toValues: Record<string, string>;
  reason: string | null;
  status: 'applied' | 'scheduled';
  createdBy: string;
}

/** Employee-row changes an event makes when it applies. */
export interface EmployeePatch {
  designationId?: string;
  branchId?: string;
  departmentId?: string;
  category?: string;
  confirmationDate?: string;
}

/**
 * Saves an event and, when due ('applied'), changes the employee row in the
 * same transaction — the record and the change can never disagree.
 */
export async function insertEventTx(write: EventWrite, patch: EmployeePatch): Promise<EmployeeEventRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(employeeEvents)
      .values({ ...write, appliedAt: write.status === 'applied' ? new Date() : null })
      .returning();
    if (write.status === 'applied' && Object.keys(patch).length) {
      await tx.update(employees).set(patch).where(eq(employees.id, write.employeeId));
    }
    return row;
  });
}

/**
 * Applies every scheduled event due on or before `today` (called on read, the
 * leave-policy pattern). Each event applies in its own transaction with its
 * stored patch; events are applied oldest first so a later one wins.
 */
export async function applyDueEvents(today: string, buildPatch: (event: EmployeeEventRow) => EmployeePatch): Promise<number> {
  const db = await getDb();
  const due = await db
    .select()
    .from(employeeEvents)
    .where(and(eq(employeeEvents.status, 'scheduled'), lte(employeeEvents.effectiveDateAd, today)))
    .orderBy(employeeEvents.effectiveDateAd, employeeEvents.createdAt);
  let applied = 0;
  for (const event of due) {
    await db.transaction(async (tx) => {
      // Only this run applies it (two readers racing: the second sees 0 rows).
      const [claimed] = await tx
        .update(employeeEvents)
        .set({ status: 'applied', appliedAt: new Date() })
        .where(and(eq(employeeEvents.id, event.id), eq(employeeEvents.status, 'scheduled')))
        .returning({ id: employeeEvents.id });
      if (!claimed) return;
      const patch = buildPatch(event);
      if (Object.keys(patch).length) {
        await tx.update(employees).set(patch).where(eq(employees.id, event.employeeId));
      }
      applied += 1;
    });
  }
  return applied;
}

/** Cancels a scheduled event (applied history is never rewritten). */
export async function cancelEvent(id: string, reason: string, userId: string): Promise<EmployeeEventRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(employeeEvents)
    .set({ status: 'cancelled', cancelReason: reason, cancelledBy: userId, cancelledAt: new Date() })
    .where(and(eq(employeeEvents.id, id), eq(employeeEvents.status, 'scheduled')))
    .returning();
  return row ?? null;
}

export async function setEventLetter(id: string, letterId: string): Promise<void> {
  const db = await getDb();
  await db.update(employeeEvents).set({ letterId }).where(eq(employeeEvents.id, id));
}

/** Register KPI counts within scope. */
export async function countEvents(scopeCondition?: SQL<unknown>): Promise<{ total: number; scheduled: number }> {
  const db = await getDb();
  const rows = await db
    .select({ status: employeeEvents.status, n: sql<number>`count(*)::int` })
    .from(employeeEvents)
    .innerJoin(employees, eq(employeeEvents.employeeId, employees.id))
    .where(scopeCondition)
    .groupBy(employeeEvents.status);
  const out = { total: 0, scheduled: 0 };
  for (const r of rows) {
    out.total += r.n;
    if (r.status === 'scheduled') out.scheduled += r.n;
  }
  return out;
}
