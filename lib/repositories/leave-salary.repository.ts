import { getDb } from '@/lib/db';
import { employees, fiscalYears, leaveLedger, leaveSalaryRuns, leaveTypes, payrollRuns, users } from '@/lib/db/schema';
import { and, desc, eq, inArray, isNull, like, lt, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { postLedgerLines, type NewLedgerLine } from '@/lib/repositories/leave.repository';

// Leave salary (4.9): Drizzle queries only. Rules in lib/engines/leave-salary.engine.ts;
// orchestration in lib/services/leave-salary.service.ts. Records are read within the caller's
// employee scope; every status move is claim-first, and the ledger lines that go with it are
// posted in the same transaction.

export type RecordRow = typeof leaveSalaryRuns.$inferSelect;
export type RecordWrite = Omit<typeof leaveSalaryRuns.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export interface RecordJoined extends RecordRow {
  employeeName: string;
  employeeCode: string;
  leaveTypeName: string;
  leaveYear: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  runYear: number | null;
  runMonth: number | null;
}

const creator = alias(users, 'creator');
const approver = alias(users, 'approver');

async function selectRecords(where: SQL<unknown> | undefined, limit: number): Promise<RecordJoined[]> {
  const rows = await (await getDb())
    .select({
      r: leaveSalaryRuns,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      leaveTypeName: leaveTypes.name,
      leaveYear: fiscalYears.label,
      createdByName: sql<string | null>`COALESCE(NULLIF(${creator.name}, ''), ${creator.email})`,
      approvedByName: sql<string | null>`COALESCE(NULLIF(${approver.name}, ''), ${approver.email})`,
      runYear: payrollRuns.payPeriodYear,
      runMonth: payrollRuns.payPeriodMonth,
    })
    .from(leaveSalaryRuns)
    .innerJoin(employees, eq(leaveSalaryRuns.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(leaveSalaryRuns.leaveTypeId, leaveTypes.id))
    .leftJoin(fiscalYears, eq(leaveSalaryRuns.fiscalYearId, fiscalYears.id))
    .leftJoin(creator, eq(leaveSalaryRuns.createdBy, creator.id))
    .leftJoin(approver, eq(leaveSalaryRuns.approvedBy, approver.id))
    .leftJoin(payrollRuns, eq(leaveSalaryRuns.payrollRunId, payrollRuns.id))
    .where(where)
    .orderBy(desc(leaveSalaryRuns.createdAt))
    .limit(limit);
  return rows.map((x) => ({ ...x.r, employeeName: x.employeeName, employeeCode: x.employeeCode, leaveTypeName: x.leaveTypeName, leaveYear: x.leaveYear, createdByName: x.createdByName, approvedByName: x.approvedByName, runYear: x.runYear, runMonth: x.runMonth }));
}

export const listRecords = (scopeCondition?: SQL<unknown>) => selectRecords(scopeCondition, 2000);

export async function findRecord(id: string, scopeCondition?: SQL<unknown>): Promise<RecordJoined | null> {
  const rows = await selectRecords(and(eq(leaveSalaryRuns.id, id), scopeCondition), 1);
  return rows[0] ?? null;
}

/** An active employee within the scope condition (who leave salary is prepared for). */
export async function activeEmployeeInScope(employeeId: string, scopeCondition?: SQL<unknown>): Promise<boolean> {
  const [row] = await (await getDb())
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.status, 'Active'), scopeCondition))
    .limit(1);
  return !!row;
}

/** A balance encashment of this leave for this person still being prepared (one at a time). */
export async function draftExists(employeeId: string, leaveTypeId: string, excludeId?: string): Promise<boolean> {
  const [row] = await (await getDb())
    .select({ id: leaveSalaryRuns.id })
    .from(leaveSalaryRuns)
    .where(
      and(
        eq(leaveSalaryRuns.employeeId, employeeId),
        eq(leaveSalaryRuns.leaveTypeId, leaveTypeId),
        eq(leaveSalaryRuns.source, 'balance'),
        eq(leaveSalaryRuns.status, 'DRAFT'),
        excludeId ? ne(leaveSalaryRuns.id, excludeId) : undefined
      )
    )
    .limit(1);
  return !!row;
}

/** All in one transaction (a year-end line already in a record stops the whole batch: the unique index). */
export async function insertRecords(rows: RecordWrite[]): Promise<RecordRow[]> {
  if (!rows.length) return [];
  return (await getDb()).transaction((tx) => tx.insert(leaveSalaryRuns).values(rows).returning());
}

/** Claim-first: changes a record only while it is still a draft. */
export async function updateDraft(id: string, set: Partial<RecordWrite>): Promise<RecordRow | null> {
  const [row] = await (await getDb())
    .update(leaveSalaryRuns)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(leaveSalaryRuns.id, id), eq(leaveSalaryRuns.status, 'DRAFT')))
    .returning();
  return row ?? null;
}

export async function deleteDraft(id: string): Promise<boolean> {
  const rows = await (await getDb())
    .delete(leaveSalaryRuns)
    .where(and(eq(leaveSalaryRuns.id, id), eq(leaveSalaryRuns.status, 'DRAFT')))
    .returning({ id: leaveSalaryRuns.id });
  return rows.length > 0;
}

/**
 * Claim-first approval: DRAFT → APPROVED, with the pay month made a real one, and the ledger
 * lines (a balance encashment's days leaving the balance) posted in the same transaction.
 */
export async function approve(id: string, userId: string, payMonth: string, ledger: NewLedgerLine[]): Promise<RecordRow | null> {
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx
      .update(leaveSalaryRuns)
      .set({ status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), paymentPeriod: payMonth, updatedAt: new Date() })
      .where(and(eq(leaveSalaryRuns.id, id), eq(leaveSalaryRuns.status, 'DRAFT')))
      .returning();
    if (!row) return null;
    await postLedgerLines(ledger, tx);
    return row;
  });
}

/** Claim-first cancellation of an approved record no pay run has taken; the days come back in the same transaction. */
export async function cancel(id: string, userId: string, reason: string, ledger: NewLedgerLine[]): Promise<RecordRow | null> {
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx
      .update(leaveSalaryRuns)
      .set({ status: 'CANCELLED', cancelReason: reason, cancelledBy: userId, cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(leaveSalaryRuns.id, id), eq(leaveSalaryRuns.status, 'APPROVED'), isNull(leaveSalaryRuns.payrollRunId)))
      .returning();
    if (!row) return null;
    await postLedgerLines(ledger, tx);
    return row;
  });
}

/** Ledger lines already posted for these refs (a move never posts its line twice). */
export async function postedRefs(employeeId: string, refs: string[]): Promise<Set<string>> {
  if (!refs.length) return new Set();
  const rows = await (await getDb())
    .select({ ref: leaveLedger.ref })
    .from(leaveLedger)
    .where(and(eq(leaveLedger.employeeId, employeeId), inArray(leaveLedger.ref, refs)));
  return new Set(rows.map((r) => r.ref).filter((r): r is string => !!r));
}

export interface DueLine {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeStatus: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fiscalYearId: string;
  leaveYear: string | null;
  entryDate: string;
  days: number;
}

/**
 * The days over the limit that leave years' openings marked to be paid (`paid_out`, ref
 * opening:<year>) and no record pays yet, within the scope (optionally only these lines).
 */
export async function dueLines(scopeCondition?: SQL<unknown>, lineIds?: string[]): Promise<DueLine[]> {
  if (lineIds && !lineIds.length) return [];
  const paid = sql`EXISTS (SELECT 1 FROM ${leaveSalaryRuns} WHERE ${leaveSalaryRuns.sourceLineId} = ${leaveLedger.id} AND ${leaveSalaryRuns.cancelledAt} IS NULL)`;
  const rows = await (await getDb())
    .select({
      id: leaveLedger.id,
      employeeId: leaveLedger.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      employeeStatus: employees.status,
      leaveTypeId: leaveLedger.leaveTypeId,
      leaveTypeName: leaveTypes.name,
      fiscalYearId: leaveLedger.fiscalYearId,
      leaveYear: fiscalYears.label,
      entryDate: leaveLedger.entryDate,
      days: leaveLedger.days,
    })
    .from(leaveLedger)
    .innerJoin(employees, eq(leaveLedger.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(leaveLedger.leaveTypeId, leaveTypes.id))
    .leftJoin(fiscalYears, eq(leaveLedger.fiscalYearId, fiscalYears.id))
    .where(
      and(
        eq(leaveLedger.kind, 'paid_out'),
        lt(leaveLedger.days, '0'),
        like(leaveLedger.ref, 'opening:%'),
        sql`NOT ${paid}`,
        scopeCondition,
        lineIds ? inArray(leaveLedger.id, lineIds) : undefined
      )
    )
    .orderBy(desc(leaveLedger.entryDate), employees.fullName)
    .limit(2000);
  return rows.map((r) => ({ ...r, entryDate: String(r.entryDate).slice(0, 10), days: Number(r.days) }));
}

/** The bell: drafts in the scope someone else prepared, never about the counting person's own record. */
export async function countDraftsFor(scopeCondition: SQL<unknown> | undefined, actor: { userId: string; employeeId: string | null }): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(leaveSalaryRuns)
    .innerJoin(employees, eq(leaveSalaryRuns.employeeId, employees.id))
    .where(
      and(
        eq(leaveSalaryRuns.status, 'DRAFT'),
        ne(leaveSalaryRuns.createdBy, actor.userId),
        actor.employeeId ? ne(leaveSalaryRuns.employeeId, actor.employeeId) : undefined,
        scopeCondition
      )
    );
  return row?.n ?? 0;
}
