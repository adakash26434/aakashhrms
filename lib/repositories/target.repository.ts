import { getDb } from '@/lib/db';
import { branches, employeeTargets, employees, targetAttachments } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';

// Targets & achievements (G15): Drizzle queries only. Rules live in
// lib/engines/target.engine.ts; orchestration in lib/services/target.service.ts.
// Attachment content is selected only by findAttachmentContent.

export type TargetRecord = typeof employeeTargets.$inferSelect;

export interface TargetWithPerson extends TargetRecord {
  employeeName: string;
  employeeCode: string;
  branch: string;
  supervisorId: string | null;
}

const personSelect = {
  t: employeeTargets,
  employeeName: employees.fullName,
  employeeCode: employees.employeeCode,
  branch: branches.name,
  supervisorId: employees.supervisorId,
};

const withPerson = (rows: { t: TargetRecord; employeeName: string; employeeCode: string; branch: string; supervisorId: string | null }[]): TargetWithPerson[] =>
  rows.map((r) => ({ ...r.t, employeeName: r.employeeName, employeeCode: r.employeeCode, branch: r.branch, supervisorId: r.supervisorId }));

export interface TargetFilter {
  /** Employee scope condition (office) – omit for none. */
  scopeCondition?: SQL<unknown>;
  employeeId?: string;
  supervisorId?: string;
  fy?: string;
  statuses?: string[];
}

export async function listTargets(filter: TargetFilter): Promise<TargetWithPerson[]> {
  const db = await getDb();
  const conds: SQL<unknown>[] = [];
  if (filter.scopeCondition) conds.push(filter.scopeCondition);
  if (filter.employeeId) conds.push(eq(employeeTargets.employeeId, filter.employeeId));
  if (filter.supervisorId) conds.push(eq(employees.supervisorId, filter.supervisorId));
  if (filter.fy) conds.push(eq(employeeTargets.fy, filter.fy));
  if (filter.statuses?.length) conds.push(inArray(employeeTargets.status, filter.statuses));
  const rows = await db
    .select(personSelect)
    .from(employeeTargets)
    .innerJoin(employees, eq(employeeTargets.employeeId, employees.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(employees.fullName), asc(employeeTargets.fy), asc(employeeTargets.periodKind), asc(employeeTargets.monthNo), asc(employeeTargets.title))
    .limit(3000);
  return withPerson(rows);
}

/**
 * Targets in one status for the bell: within an employee scope, or of one supervisor's reports,
 * leaving out one employee's own (S42: nobody reviews or closes their own).
 */
export async function countInStatus(
  status: string,
  filter: { scopeCondition?: SQL<unknown>; supervisorId?: string; excludeEmployeeId: string | null },
): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(employeeTargets)
    .innerJoin(employees, eq(employeeTargets.employeeId, employees.id))
    .where(
      and(
        eq(employeeTargets.status, status),
        filter.scopeCondition,
        filter.supervisorId ? eq(employees.supervisorId, filter.supervisorId) : undefined,
        filter.excludeEmployeeId ? ne(employeeTargets.employeeId, filter.excludeEmployeeId) : undefined,
      ),
    );
  return row?.n ?? 0;
}

export async function findTarget(id: string, scopeCondition?: SQL<unknown>): Promise<TargetWithPerson | null> {
  const db = await getDb();
  const base = eq(employeeTargets.id, id);
  const [row] = await db
    .select(personSelect)
    .from(employeeTargets)
    .innerJoin(employees, eq(employeeTargets.employeeId, employees.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(scopeCondition ? and(base, scopeCondition) : base)
    .limit(1);
  return row ? withPerson([row])[0] : null;
}

export async function distinctFiscalYears(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ fy: employeeTargets.fy }).from(employeeTargets).orderBy(desc(employeeTargets.fy));
  return rows.map((r) => r.fy);
}

export interface TargetWrite {
  employeeId: string;
  periodKind: string;
  fy: string;
  monthNo: number | null;
  title: string;
  unit: string;
  targetValue: string;
  weight: string;
}

/** Titles already set for these employees in this period (to skip duplicates). */
export async function existingTitles(employeeIds: string[], periodKind: string, fy: string, monthNo: number | null): Promise<Set<string>> {
  if (!employeeIds.length) return new Set();
  const db = await getDb();
  const rows = await db
    .select({ employeeId: employeeTargets.employeeId, title: employeeTargets.title })
    .from(employeeTargets)
    .where(and(
      inArray(employeeTargets.employeeId, employeeIds),
      eq(employeeTargets.periodKind, periodKind),
      eq(employeeTargets.fy, fy),
      monthNo === null ? isNull(employeeTargets.monthNo) : eq(employeeTargets.monthNo, monthNo),
    ));
  return new Set(rows.map((r) => `${r.employeeId}|${r.title.toLowerCase()}`));
}

export async function insertTargets(rows: TargetWrite[], userId: string): Promise<number> {
  if (!rows.length) return 0;
  const db = await getDb();
  await db.insert(employeeTargets).values(rows.map((r) => ({ ...r, createdBy: userId, updatedBy: userId })));
  return rows.length;
}

/** Changes a target nobody has reported on; null when it is no longer open. */
export async function updateOpenTarget(id: string, data: Pick<TargetWrite, 'title' | 'unit' | 'targetValue' | 'weight'>, userId: string): Promise<TargetRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(employeeTargets)
    .set({ ...data, updatedBy: userId })
    .where(and(eq(employeeTargets.id, id), eq(employeeTargets.status, 'set'), isNull(employeeTargets.achievedValue)))
    .returning();
  return row ?? null;
}

export async function deleteOpenTarget(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(employeeTargets)
    .where(and(eq(employeeTargets.id, id), eq(employeeTargets.status, 'set'), isNull(employeeTargets.achievedValue)))
    .returning({ id: employeeTargets.id });
  return rows.length > 0;
}

/**
 * Claim-first step: changes the row only while it still has one of the expected
 * statuses (and, for the employee's own steps, still belongs to them). Null
 * when someone else moved it first.
 */
export async function claim(id: string, from: string[], set: Partial<typeof employeeTargets.$inferInsert>, userId: string, owner?: string): Promise<TargetRecord | null> {
  const db = await getDb();
  const conds = [eq(employeeTargets.id, id), inArray(employeeTargets.status, from)];
  if (owner) conds.push(eq(employeeTargets.employeeId, owner));
  const [row] = await db
    .update(employeeTargets)
    .set({ ...set, updatedBy: userId })
    .where(and(...conds))
    .returning();
  return row ?? null;
}

// ---- attachments ------------------------------------------------------------

export interface AttachmentMeta {
  id: string;
  targetId: string | null;
  fileName: string;
  mime: string;
  size: number;
}

const attachmentMeta = {
  id: targetAttachments.id,
  targetId: targetAttachments.targetId,
  fileName: targetAttachments.fileName,
  mime: targetAttachments.mime,
  size: targetAttachments.size,
};

export async function attachmentsFor(targetIds: string[]): Promise<AttachmentMeta[]> {
  if (!targetIds.length) return [];
  const db = await getDb();
  return db.select(attachmentMeta).from(targetAttachments).where(inArray(targetAttachments.targetId, targetIds)).orderBy(asc(targetAttachments.uploadedAt));
}

export async function countAttached(targetId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(targetAttachments).where(eq(targetAttachments.targetId, targetId));
  return row?.n ?? 0;
}

export async function countStagedBy(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(targetAttachments)
    .where(and(isNull(targetAttachments.targetId), eq(targetAttachments.uploadedBy, userId)));
  return row?.n ?? 0;
}

/** Removes uploads that were never saved with a target (older than a day). */
export async function pruneStaged(): Promise<void> {
  const db = await getDb();
  await db.delete(targetAttachments).where(and(isNull(targetAttachments.targetId), lt(targetAttachments.uploadedAt, sql`now() - interval '1 day'`)));
}

export async function insertStaged(input: { fileName: string; mime: string; size: number; content: Buffer; uploadedBy: string }): Promise<AttachmentMeta> {
  const db = await getDb();
  const [row] = await db.insert(targetAttachments).values({ ...input, targetId: null }).returning(attachmentMeta);
  return row;
}

/** Attaches the user's own staged uploads to a target. Returns how many were attached. */
export async function linkStaged(ids: string[], targetId: string, userId: string): Promise<number> {
  if (!ids.length) return 0;
  const db = await getDb();
  const rows = await db
    .update(targetAttachments)
    .set({ targetId })
    .where(and(inArray(targetAttachments.id, ids), isNull(targetAttachments.targetId), eq(targetAttachments.uploadedBy, userId)))
    .returning({ id: targetAttachments.id });
  return rows.length;
}

export async function findAttachment(id: string): Promise<(AttachmentMeta & { uploadedBy: string }) | null> {
  const db = await getDb();
  const [row] = await db.select({ ...attachmentMeta, uploadedBy: targetAttachments.uploadedBy }).from(targetAttachments).where(eq(targetAttachments.id, id)).limit(1);
  return row ?? null;
}

export async function findAttachmentContent(id: string): Promise<Buffer | null> {
  const db = await getDb();
  const [row] = await db.select({ content: targetAttachments.content }).from(targetAttachments).where(eq(targetAttachments.id, id)).limit(1);
  return row?.content ?? null;
}

/** Deletes one attachment of a target (the caller has checked who may). */
export async function deleteAttachment(id: string, targetId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(targetAttachments).where(and(eq(targetAttachments.id, id), eq(targetAttachments.targetId, targetId))).returning({ id: targetAttachments.id });
  return rows.length > 0;
}

/** Deletes an upload that was never saved (only its uploader). */
export async function deleteStaged(id: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(targetAttachments)
    .where(and(eq(targetAttachments.id, id), isNull(targetAttachments.targetId), eq(targetAttachments.uploadedBy, userId)))
    .returning({ id: targetAttachments.id });
  return rows.length > 0;
}

/** Whether the employee is reachable through this scope condition. */
export async function employeeInScope(employeeId: string, scopeCondition: SQL<unknown> | undefined): Promise<boolean> {
  const db = await getDb();
  const base = eq(employees.id, employeeId);
  const [row] = await db.select({ id: employees.id }).from(employees).where(scopeCondition ? and(base, scopeCondition) : base).limit(1);
  return !!row;
}

export async function hasReports(supervisorEmployeeId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: employees.id }).from(employees).where(eq(employees.supervisorId, supervisorEmployeeId)).limit(1);
  return !!row;
}
