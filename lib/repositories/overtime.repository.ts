import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { approvalActions, auditLogs, overtimeEntries, systemConfig, users } from "@/lib/db/schema";
import { OVERTIME_POLICY_KEY } from "@/lib/engines/overtime.engine";
import type { ApprovalActionKind, ApprovalRoute } from "@/lib/types/approval";
import type { OvertimeEntry } from "@/lib/types/overtime";

// Overtime (4.7): the company's policy is one JSON value in system_config;
// its history is the audit log (module OT_RULES, record "overtime.policy").
// 4.7b: decided overtime days (overtime_entries) and their approval
// timeline (approval_actions, module OVERTIME).

export const POLICY_KEY = OVERTIME_POLICY_KEY;

/** The stored policy (unparsed JSON), or null before the company has one. */
export async function findPolicyValue(): Promise<string | null> {
  const [row] = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, POLICY_KEY)).limit(1);
  return row?.value ?? null;
}

export async function savePolicyValue(value: string): Promise<void> {
  await (await getDb())
    .insert(systemConfig)
    .values({ key: POLICY_KEY, value, dataType: "json" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, dataType: "json", updatedAt: new Date() } });
}

/** Saved policy changes, newest first, with who made them. */
export async function findPolicyHistory(limit = 20): Promise<{ at: Date; by: string; oldValues: unknown; newValues: unknown }[]> {
  const db = await getDb();
  const rows = await db
    .select({ at: auditLogs.createdAt, userId: auditLogs.userId, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues })
    .from(auditLogs)
    .where(and(eq(auditLogs.module, "OT_RULES"), eq(auditLogs.recordId, POLICY_KEY), eq(auditLogs.result, "SUCCESS")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const names = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids)) : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name || n.email]));
  return rows.map((r) => ({ at: r.at, by: r.userId ? nameOf.get(r.userId) ?? "Unknown user" : "System", oldValues: r.oldValues, newValues: r.newValues }));
}

// ---------------------------------------------------------------------------
// 4.7b Overtime entries
// ---------------------------------------------------------------------------

export const MODULE = "OVERTIME";

type EntryRow = typeof overtimeEntries.$inferSelect;

const STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

const toEntry = (r: EntryRow): OvertimeEntry => ({
  id: r.id,
  employeeId: r.employeeId,
  workDate: String(r.workDate).slice(0, 10),
  source: r.source === "manual" ? "manual" : "detected",
  dayKind: r.dayKind === "off" ? "off" : "work",
  detectedMinutes: r.detectedMinutes,
  requestedMinutes: r.requestedMinutes,
  approvedMinutes: r.approvedMinutes,
  status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as OvertimeEntry["status"]) : "pending",
  overLimit: r.overLimit,
  reason: r.reason,
  preparedBy: r.preparedBy,
  decidedBy: r.decidedBy,
  decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  decisionNote: r.decisionNote,
  approvalRoute: r.approvalRoute,
  createdAt: r.createdAt.toISOString(),
});

/** Entries for some employees between two dates (everyone when no employees are given). */
export async function findEntries(opts: { employeeIds?: string[]; from?: string; to?: string; status?: OvertimeEntry["status"] }): Promise<OvertimeEntry[]> {
  if (opts.employeeIds && !opts.employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(overtimeEntries)
    .where(
      and(
        opts.employeeIds ? inArray(overtimeEntries.employeeId, opts.employeeIds) : undefined,
        opts.from ? gte(overtimeEntries.workDate, opts.from) : undefined,
        opts.to ? lte(overtimeEntries.workDate, opts.to) : undefined,
        opts.status ? eq(overtimeEntries.status, opts.status) : undefined
      )
    );
  return rows.map(toEntry);
}

/** One entry by id. */
export async function findEntryById(id: string): Promise<OvertimeEntry | null> {
  const [row] = await (await getDb()).select().from(overtimeEntries).where(eq(overtimeEntries.id, id)).limit(1);
  return row ? toEntry(row) : null;
}

/**
 * Overtime added by hand: a new waiting entry, or one refused or withdrawn
 * before, raised again (one per person and day). Null when one is already
 * waiting or approved for that day.
 */
export async function createManual(row: { employeeId: string; date: string; dayKind: "work" | "off"; minutes: number; reason: string; preparedBy: string }): Promise<string | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const values = {
      dayKind: row.dayKind,
      requestedMinutes: row.minutes,
      approvedMinutes: 0,
      detectedMinutes: 0,
      status: "pending",
      overLimit: false,
      reason: row.reason,
      preparedBy: row.preparedBy,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      approvalRoute: null,
      createdAt: now,
      updatedAt: now,
    };
    const [saved] = await tx
      .insert(overtimeEntries)
      .values({ employeeId: row.employeeId, workDate: row.date, source: "manual", ...values })
      .onConflictDoUpdate({
        target: [overtimeEntries.employeeId, overtimeEntries.workDate, overtimeEntries.source],
        set: values,
        setWhere: inArray(overtimeEntries.status, ["rejected", "withdrawn"]),
      })
      .returning({ id: overtimeEntries.id });
    if (!saved) return null;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: saved.id, level: 0, actorId: row.preparedBy, action: "submitted", note: row.reason, createdAt: now });
    return saved.id;
  });
}

interface Decision {
  status: "approved" | "rejected" | "withdrawn";
  approvedMinutes: number;
  overLimit: boolean;
  route: ApprovalRoute | null;
  actorId: string;
  action: ApprovalActionKind;
  note: string | null;
}

/**
 * Decides detected overtime: writes the day's entry with the minutes detected
 * now. `previous` is the entry the decision was made against (null: none
 * yet); false when someone else decided it a moment ago.
 */
export async function decideDetected(params: Decision & { employeeId: string; date: string; dayKind: "work" | "off"; detectedMinutes: number; previous: OvertimeEntry | null }): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const values = {
      dayKind: params.dayKind,
      detectedMinutes: params.detectedMinutes,
      approvedMinutes: params.approvedMinutes,
      status: params.status,
      overLimit: params.overLimit,
      decidedBy: params.actorId,
      decidedAt: now,
      decisionNote: params.note,
      approvalRoute: params.status === "approved" ? params.route : null,
      updatedAt: now,
    };
    let id: string | undefined;
    if (params.previous) {
      const p = params.previous;
      const [row] = await tx
        .update(overtimeEntries)
        .set(values)
        .where(and(eq(overtimeEntries.id, p.id), eq(overtimeEntries.status, p.status), eq(overtimeEntries.detectedMinutes, p.detectedMinutes)))
        .returning({ id: overtimeEntries.id });
      id = row?.id;
    } else {
      const [row] = await tx
        .insert(overtimeEntries)
        .values({ employeeId: params.employeeId, workDate: params.date, source: "detected", requestedMinutes: 0, preparedBy: null, createdAt: now, ...values })
        .onConflictDoNothing()
        .returning({ id: overtimeEntries.id });
      id = row?.id;
    }
    if (!id) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: id, level: 0, actorId: params.actorId, action: params.action, note: params.note, createdAt: now });
    return true;
  });
}

/** Decides (or withdraws) overtime added by hand, only while it waits; false when someone else acted first. */
export async function decideManual(params: Decision & { id: string }): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(overtimeEntries)
      .set({
        status: params.status,
        approvedMinutes: params.approvedMinutes,
        overLimit: params.overLimit,
        decidedBy: params.actorId,
        decidedAt: now,
        decisionNote: params.note,
        approvalRoute: params.status === "approved" ? params.route : null,
        updatedAt: now,
      })
      .where(and(eq(overtimeEntries.id, params.id), eq(overtimeEntries.status, "pending")))
      .returning({ id: overtimeEntries.id });
    if (!row) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: params.id, level: 0, actorId: params.actorId, action: params.action, note: params.note, createdAt: now });
    return true;
  });
}

/** Approval steps of some entries, oldest first. */
export async function findTimeline(ids: string[]) {
  if (!ids.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, ids)))
    .orderBy(asc(approvalActions.createdAt));
}
