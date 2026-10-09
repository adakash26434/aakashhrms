import { getDb } from '@/lib/db';
import { branches, employees, notices, users } from '@/lib/db/schema';
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

// Notice board (G14): Drizzle queries only. Rules in lib/engines/notice.engine.ts.

export type NoticeRecord = typeof notices.$inferSelect;

export interface NoticeJoined extends NoticeRecord {
  branch: string | null;
  authorName: string | null;
}

const joined = { n: notices, branch: branches.name, authorName: sql<string | null>`COALESCE(NULLIF(${users.name}, ''), ${users.email})` };
const flatten = (r: { n: NoticeRecord; branch: string | null; authorName: string | null }): NoticeJoined => ({ ...r.n, branch: r.branch, authorName: r.authorName });

export async function listNotices(): Promise<NoticeJoined[]> {
  const db = await getDb();
  const rows = await db
    .select(joined)
    .from(notices)
    .leftJoin(branches, eq(notices.branchId, branches.id))
    .leftJoin(users, eq(notices.createdBy, users.id))
    .orderBy(desc(notices.publishAd))
    .limit(500);
  return rows.map(flatten);
}

export async function findNotice(id: string): Promise<NoticeJoined | null> {
  const db = await getDb();
  const rows = await db.select(joined).from(notices).leftJoin(branches, eq(notices.branchId, branches.id)).leftJoin(users, eq(notices.createdBy, users.id)).where(eq(notices.id, id)).limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

/** Published notices addressed to the company or to any of `branchIds` ('all' = every branch). Date window is applied by the engine. */
export async function publishedFor(branchIds: string[] | 'all'): Promise<NoticeJoined[]> {
  const db = await getDb();
  const audience: SQL<unknown> | undefined = branchIds === 'all' ? undefined : branchIds.length ? or(isNull(notices.branchId), inArray(notices.branchId, branchIds)) : isNull(notices.branchId);
  const rows = await db
    .select(joined)
    .from(notices)
    .leftJoin(branches, eq(notices.branchId, branches.id))
    .leftJoin(users, eq(notices.createdBy, users.id))
    .where(and(eq(notices.status, 'published'), audience))
    .orderBy(desc(notices.publishAd))
    .limit(100);
  return rows.map(flatten);
}

export interface NoticeWrite {
  title: string;
  body: string;
  branchId: string | null;
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
}

export async function insertNotice(data: NoticeWrite, userId: string): Promise<NoticeRecord> {
  const db = await getDb();
  const [row] = await db.insert(notices).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateNotice(id: string, data: NoticeWrite, userId: string): Promise<NoticeRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(notices)
    .set({ ...data, updatedBy: userId })
    .where(and(eq(notices.id, id), eq(notices.status, 'published')))
    .returning();
  return row ?? null;
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

export async function branchOfEmployee(employeeId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ branchId: employees.branchId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  return row?.branchId ?? null;
}
