import { getDb } from "@/lib/db";
import { auditLogs, users, roles } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { formatRecordTitle } from "@/lib/engines/audit.engine";

// The audit trail (4.13). Entries are written by `recordAuditLog` and never changed; the Audit
// log screen reads them newest first, a period and filters at a time.

export interface AuditQuery {
  since?: Date | null;
  module?: string;
  action?: string;
  /** "done": succeeded; "refused": a DENIED_* attempt. */
  outcome?: "" | "done" | "refused";
  userId?: string;
  /** Matches the record, the user's name or email. */
  search?: string;
  limit?: number;
}

export interface AuditEntryRecord {
  id: string;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  roleNameAtTime: string | null;
  action: string;
  module: string;
  recordId: string | null;
  recordTitle: string;
  result: string;
  ipAddress: string | null;
}

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(q: AuditQuery): SQL | undefined {
  const search = q.search?.trim();
  return and(
    // gte maps the Date through the column (a raw sql param would reach the driver as a Date).
    q.since ? gte(auditLogs.createdAt, q.since) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module and action are pgEnum columns; the values were checked against the lists
    q.module ? eq(auditLogs.module, q.module as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q.action ? eq(auditLogs.action, q.action as any) : undefined,
    q.outcome === "refused" ? sql`${auditLogs.result} like 'DENIED%'` : q.outcome === "done" ? sql`${auditLogs.result} not like 'DENIED%'` : undefined,
    q.userId ? eq(auditLogs.userId, q.userId) : undefined,
    // The record and who, never the stored values themselves.
    search
      ? or(
          ilike(auditLogs.recordId, `%${escapeLike(search)}%`),
          ilike(users.name, `%${escapeLike(search)}%`),
          ilike(users.email, `%${escapeLike(search)}%`),
          sql`coalesce(${auditLogs.newValues}->>'name', ${auditLogs.oldValues}->>'name', ${auditLogs.newValues}->>'title', '') ilike ${`%${escapeLike(search)}%`}`
        )
      : undefined
  );
}

/** Entries matching the query, newest first (values left out: the detail reads them). */
export async function findAuditEntries(q: AuditQuery = {}): Promise<AuditEntryRecord[]> {
  const rows = await (await getDb())
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      userId: auditLogs.userId,
      userName: users.name,
      userEmail: users.email,
      roleNameAtTime: roles.name,
      action: auditLogs.action,
      module: auditLogs.module,
      recordId: auditLogs.recordId,
      result: auditLogs.result,
      ipAddress: auditLogs.ipAddress,
      // The title fields only, not the whole values.
      titleNew: sql<Record<string, unknown> | null>`jsonb_build_object('title', ${auditLogs.newValues}->'title', 'name', ${auditLogs.newValues}->'name', 'runName', ${auditLogs.newValues}->'runName', 'slabName', ${auditLogs.newValues}->'slabName', 'code', ${auditLogs.newValues}->'code')`,
      titleOld: sql<Record<string, unknown> | null>`jsonb_build_object('title', ${auditLogs.oldValues}->'title', 'name', ${auditLogs.oldValues}->'name', 'runName', ${auditLogs.oldValues}->'runName', 'slabName', ${auditLogs.oldValues}->'slabName', 'code', ${auditLogs.oldValues}->'code')`,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(roles, eq(roles.id, auditLogs.roleIdAtTime))
    .where(conditions(q))
    .orderBy(desc(auditLogs.createdAt), asc(auditLogs.id))
    .limit(Math.min(Math.max(q.limit ?? 100, 1), 2000));
  const clean = (v: Record<string, unknown> | null) => (v ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)) : null);
  return rows.map((r) => {
    const nv = clean(r.titleNew);
    const ov = clean(r.titleOld);
    return {
      id: r.id,
      createdAt: r.createdAt,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      roleNameAtTime: r.roleNameAtTime,
      action: r.action,
      module: r.module,
      recordId: r.recordId,
      recordTitle: formatRecordTitle(r.recordId, r.module, nv && Object.keys(nv).length ? nv : null, ov && Object.keys(ov).length ? ov : null),
      result: r.result,
      ipAddress: r.ipAddress,
    };
  });
}

/** How many entries match (the screen shows the newest of them). */
export async function countAuditEntries(q: AuditQuery = {}): Promise<{ total: number; refused: number }> {
  const [row] = await (await getDb())
    .select({ total: sql<number>`count(*)::int`, refused: sql<number>`count(*) filter (where ${auditLogs.result} like 'DENIED%')::int` })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(conditions(q));
  return { total: row?.total ?? 0, refused: row?.refused ?? 0 };
}

/** One entry with its values (the detail pane). */
export async function findAuditEntry(id: string): Promise<(AuditEntryRecord & { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null }) | null> {
  const [r] = await (await getDb())
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      userId: auditLogs.userId,
      userName: users.name,
      userEmail: users.email,
      roleNameAtTime: roles.name,
      action: auditLogs.action,
      module: auditLogs.module,
      recordId: auditLogs.recordId,
      result: auditLogs.result,
      ipAddress: auditLogs.ipAddress,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(roles, eq(roles.id, auditLogs.roleIdAtTime))
    .where(eq(auditLogs.id, id))
    .limit(1);
  if (!r) return null;
  const oldValues = (r.oldValues as Record<string, unknown> | null) ?? null;
  const newValues = (r.newValues as Record<string, unknown> | null) ?? null;
  return { ...r, oldValues, newValues, recordTitle: formatRecordTitle(r.recordId, r.module, newValues, oldValues) };
}

/** Everyone who can appear as "who": the user filter's choices. */
export async function findAuditUsers(): Promise<{ id: string; label: string }[]> {
  const rows = await (await getDb()).select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(asc(sql`lower(coalesce(${users.name}, ${users.email}))`));
  return rows.map((r) => ({ id: r.id, label: r.name?.trim() || r.email }));
}

/** Audit entries for one record (e.g. an employee's change history, 4.2), newest first. */
export async function findAuditTrailForRecord(module: string, recordId: string, limit = 50) {
  return (await getDb())
    .select({
      id: auditLogs.id,
      at: auditLogs.createdAt,
      userName: users.name,
      action: auditLogs.action,
      result: auditLogs.result,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module is a pgEnum column
    .where(and(eq(auditLogs.module, module as any), eq(auditLogs.recordId, recordId)))
    .orderBy(sql`${auditLogs.createdAt} desc`)
    .limit(limit);
}
