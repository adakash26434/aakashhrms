import { getDb } from '@/lib/db';
import { branches, departments, employees, noticeRecipients, notices, users } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { Reader } from '@/lib/engines/notice.engine';

// Notice board (G14): Drizzle queries only. Rules in lib/engines/notice.engine.ts.

export type NoticeRecord = typeof notices.$inferSelect;

export interface NoticeJoined extends NoticeRecord {
  branch: string | null;
  department: string | null;
  authorName: string | null;
  recipients: { id: string; name: string }[];
}

const joined = {
  n: notices,
  branch: branches.name,
  department: departments.name,
  authorName: sql<string | null>`COALESCE(NULLIF(${users.name}, ''), ${users.email})`,
};
type JoinedRow = { n: NoticeRecord; branch: string | null; department: string | null; authorName: string | null };

const base = (db: Awaited<ReturnType<typeof getDb>>) =>
  db
    .select(joined)
    .from(notices)
    .leftJoin(branches, eq(notices.branchId, branches.id))
    .leftJoin(departments, eq(notices.departmentId, departments.id))
    .leftJoin(users, eq(notices.createdBy, users.id));

async function withRecipients(rows: JoinedRow[]): Promise<NoticeJoined[]> {
  const ids = rows.filter((r) => r.n.audience === 'employees').map((r) => r.n.id);
  const byNotice = new Map<string, { id: string; name: string }[]>();
  if (ids.length) {
    const db = await getDb();
    const found = await db
      .select({ noticeId: noticeRecipients.noticeId, id: employees.id, name: employees.fullName })
      .from(noticeRecipients)
      .innerJoin(employees, eq(noticeRecipients.employeeId, employees.id))
      .where(inArray(noticeRecipients.noticeId, ids))
      .orderBy(asc(employees.fullName));
    for (const f of found) byNotice.set(f.noticeId, [...(byNotice.get(f.noticeId) ?? []), { id: f.id, name: f.name }]);
  }
  return rows.map((r) => ({ ...r.n, branch: r.branch, department: r.department, authorName: r.authorName, recipients: byNotice.get(r.n.id) ?? [] }));
}

export async function listNotices(): Promise<NoticeJoined[]> {
  const rows = await base(await getDb()).orderBy(desc(notices.publishAd)).limit(500);
  return withRecipients(rows);
}

export async function findNotice(id: string): Promise<NoticeJoined | null> {
  const rows = await base(await getDb()).where(eq(notices.id, id)).limit(1);
  return (await withRecipients(rows))[0] ?? null;
}

/**
 * Published, already-started notices that could be addressed to this reader.
 * The engine's isVisible stays the authority (expiry, exact audience); this
 * narrows the query so a busy board never pages past a reader's own notices.
 */
export async function publishedFor(reader: Reader, today: string): Promise<NoticeJoined[]> {
  const audience: SQL<unknown>[] = [eq(notices.audience, 'company')];
  if (reader.branches === 'all') audience.push(eq(notices.audience, 'branch'));
  else if (reader.branches.length) audience.push(and(eq(notices.audience, 'branch'), inArray(notices.branchId, reader.branches))!);
  if (reader.departments === 'all') audience.push(eq(notices.audience, 'department'));
  else if (reader.departments.length) audience.push(and(eq(notices.audience, 'department'), inArray(notices.departmentId, reader.departments))!);
  if (reader.employeeId) {
    audience.push(and(eq(notices.audience, 'employees'), sql`EXISTS (SELECT 1 FROM ${noticeRecipients} nr WHERE nr.notice_id = ${notices.id} AND nr.employee_id = ${reader.employeeId})`)!);
  }
  const rows = await base(await getDb())
    .where(and(eq(notices.status, 'published'), lte(notices.publishAd, today), or(...audience)))
    .orderBy(desc(notices.publishAd))
    .limit(100);
  return withRecipients(rows);
}

export interface NoticeWrite {
  title: string;
  body: string;
  audience: string;
  branchId: string | null;
  departmentId: string | null;
  recipientIds: string[];
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
}

const columns = (d: NoticeWrite) => ({ title: d.title, body: d.body, audience: d.audience, branchId: d.branchId, departmentId: d.departmentId, publishAd: d.publishAd, expiresAd: d.expiresAd, pinned: d.pinned });

async function setRecipients(tx: Pick<Awaited<ReturnType<typeof getDb>>, 'delete' | 'insert'>, noticeId: string, ids: string[]) {
  await tx.delete(noticeRecipients).where(eq(noticeRecipients.noticeId, noticeId));
  if (ids.length) await tx.insert(noticeRecipients).values(ids.map((employeeId) => ({ noticeId, employeeId })));
}

export async function insertNotice(data: NoticeWrite, userId: string): Promise<NoticeRecord> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(notices).values({ ...columns(data), createdBy: userId, updatedBy: userId }).returning();
    await setRecipients(tx, row.id, data.recipientIds);
    return row;
  });
}

export async function updateNotice(id: string, data: NoticeWrite, userId: string): Promise<NoticeRecord | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(notices)
      .set({ ...columns(data), updatedBy: userId })
      .where(and(eq(notices.id, id), eq(notices.status, 'published')))
      .returning();
    if (!row) return null;
    await setRecipients(tx, id, data.recipientIds);
    return row;
  });
}

/** Withdrawn notices stay for the record; nothing deletes them. */
export async function withdrawNotice(id: string, userId: string): Promise<NoticeRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(notices)
    .set({ status: 'withdrawn', updatedBy: userId })
    .where(and(eq(notices.id, id), eq(notices.status, 'published')))
    .returning();
  return row ?? null;
}

export async function departmentOptions(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  return db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.status, 'active')).orderBy(asc(departments.name));
}

/** Ids from `ids` that are active employees inside the scope condition. */
export async function employeesInScope(ids: string[], scopeCondition: SQL<unknown> | undefined): Promise<string[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const where = and(inArray(employees.id, ids), eq(employees.status, 'Active'), scopeCondition);
  const rows = await db.select({ id: employees.id }).from(employees).where(where);
  return rows.map((r) => r.id);
}

/** Where the employee sits, for the reader's own branch / department notices. */
export async function placementOfEmployee(employeeId: string): Promise<{ branchId: string | null; departmentId: string | null }> {
  const db = await getDb();
  const [row] = await db.select({ branchId: employees.branchId, departmentId: employees.departmentId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  return { branchId: row?.branchId ?? null, departmentId: row?.departmentId ?? null };
}
