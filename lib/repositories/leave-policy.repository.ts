import { getDb } from "@/lib/db";
import { approvalActions, leavePolicyExceptions, leaveTypeChanges, leaveTypes, permissions, rolePermissions, roles, userRoles, users, employees } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { postLedgerLines, type NewLedgerLine } from "@/lib/repositories/leave.repository";
import type { ApprovalActionKind, ApprovalRoute } from "@/lib/types/approval";
import type { PolicyApplies, PolicyChangeStatus, PolicyException, PolicySetting, PolicyValues } from "@/lib/types/leave-policy";

// Leave policies (4.6c): versions of leave type settings, their approval
// timeline (module LEAVE_TYPES) and the platform's exceptions (read-only here).

const MODULE = "LEAVE_TYPES";

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
export type ChangeRow = typeof leaveTypeChanges.$inferSelect;

/** The leave_types columns for some settings (a certificate "never" clears the document rule). */
function columnsFor(values: Partial<PolicyValues>): Partial<typeof leaveTypes.$inferInsert> {
  const set: Partial<typeof leaveTypes.$inferInsert> = {};
  for (const [k, v] of Object.entries(values) as [PolicySetting, PolicyValues[PolicySetting]][]) {
    if (k === "days") set.noOfDays = String(v);
    else if (k === "paidDays") {
      set.paidDaysPerEvent = v === null ? null : String(v);
      set.maxPaidDays = v === null ? null : String(v);
    } else if (k === "cap") set.accumulationCap = v === null ? null : String(v);
    else if (k === "accrualEveryDays") set.accrualEveryDays = v as number | null;
    else if (k === "certificateAfter") {
      set.requiresDocument = v !== null;
      set.documentThresholdDays = v as number | null;
    } else if (k === "expiryDays") set.expiryDays = v as number | null;
    else if (k === "allowHalfDay") set.allowHalfDay = Boolean(v);
    else if (k === "dayBasis") set.dayBasis = v as string;
  }
  return set;
}

async function applyToType(tx: Tx, leaveTypeId: string, values: Partial<PolicyValues>) {
  const set = columnsFor(values);
  if (!Object.keys(set).length) return;
  await tx.update(leaveTypes).set({ ...set, updatedAt: new Date() }).where(eq(leaveTypes.id, leaveTypeId));
}

export async function findChanges(leaveTypeIds?: string[]): Promise<ChangeRow[]> {
  if (leaveTypeIds && !leaveTypeIds.length) return [];
  return (await getDb())
    .select()
    .from(leaveTypeChanges)
    .where(leaveTypeIds ? inArray(leaveTypeChanges.leaveTypeId, leaveTypeIds) : undefined)
    .orderBy(desc(leaveTypeChanges.preparedAt));
}

export async function findChange(id: string): Promise<ChangeRow | null> {
  const rows = await (await getDb()).select().from(leaveTypeChanges).where(eq(leaveTypeChanges.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findPendingChanges(): Promise<ChangeRow[]> {
  return (await getDb()).select().from(leaveTypeChanges).where(eq(leaveTypeChanges.status, "pending"));
}

/** Timeline steps of some changes, oldest first. */
export async function findApprovalActions(requestIds: string[]) {
  if (!requestIds.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, requestIds)))
    .orderBy(asc(approvalActions.createdAt));
}

/** A proposal waiting for a second person (one per leave type; the unique index refuses a second). */
export async function createChange(p: {
  leaveTypeId: string;
  before: Partial<PolicyValues>;
  after: Partial<PolicyValues>;
  reason: string;
  applies: PolicyApplies;
  effectiveFrom: string | null;
  preparedBy: string;
}): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(leaveTypeChanges)
      .values({
        leaveTypeId: p.leaveTypeId,
        before: p.before,
        after: p.after,
        reason: p.reason,
        applies: p.applies,
        effectiveFrom: p.effectiveFrom,
        status: "pending",
        source: "company",
        preparedBy: p.preparedBy,
        approvalType: "simple",
        approvalLevels: [],
        currentLevel: 0,
      })
      .returning({ id: leaveTypeChanges.id });
    await tx.insert(approvalActions).values({ module: MODULE, requestId: row.id, level: 0, actorId: p.preparedBy, action: "submitted", note: p.reason });
    return row.id;
  });
}

/**
 * Decides a waiting change in one transaction: the status (only if still
 * pending), the timeline step and, when approved, the settings that apply now,
 * any top-up ledger lines and older scheduled changes it replaces. Returns
 * false when someone else decided it first.
 */
export async function decideChange(p: {
  id: string;
  leaveTypeId: string;
  status: Exclude<PolicyChangeStatus, "pending" | "replaced">;
  route: ApprovalRoute | null;
  actorId: string;
  action: ApprovalActionKind;
  note: string | null;
  now?: Partial<PolicyValues>;
  /** Nothing waits for a later date: the change is fully applied. */
  complete?: boolean;
  ledger?: NewLedgerLine[];
  /** Older scheduled changes whose waiting settings this one replaces. */
  replaces?: string[];
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const at = new Date();
    const done = await tx
      .update(leaveTypeChanges)
      .set({ status: p.status, approvalRoute: p.route, decidedBy: p.actorId, decidedAt: at, decisionNote: p.note, appliedAt: p.status === "approved" && p.complete ? at : null })
      .where(and(eq(leaveTypeChanges.id, p.id), eq(leaveTypeChanges.status, "pending")))
      .returning({ id: leaveTypeChanges.id });
    if (!done.length) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: p.id, level: 0, actorId: p.actorId, action: p.action, note: p.note, createdAt: at });
    if (p.status === "approved") {
      if (p.now) await applyToType(tx, p.leaveTypeId, p.now);
      if (p.replaces?.length) {
        await tx
          .update(leaveTypeChanges)
          .set({ status: "replaced", appliedAt: at, decisionNote: "Replaced by a later approved change" })
          .where(and(inArray(leaveTypeChanges.id, p.replaces), eq(leaveTypeChanges.status, "approved"), isNull(leaveTypeChanges.appliedAt)));
      }
      if (p.ledger?.length) await postLedgerLines(p.ledger, tx);
    }
    return true;
  });
}

/** Approved changes with a part waiting for its date that has come. */
export async function findDueChanges(today: string): Promise<ChangeRow[]> {
  return (await getDb())
    .select()
    .from(leaveTypeChanges)
    .where(and(eq(leaveTypeChanges.status, "approved"), isNull(leaveTypeChanges.appliedAt), lte(leaveTypeChanges.effectiveFrom, today)));
}

/** Applies the waiting part of a change once (guarded by applied_at). */
export async function applyDue(id: string, leaveTypeId: string, values: Partial<PolicyValues>): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const done = await tx
      .update(leaveTypeChanges)
      .set({ appliedAt: new Date() })
      .where(and(eq(leaveTypeChanges.id, id), eq(leaveTypeChanges.status, "approved"), isNull(leaveTypeChanges.appliedAt)))
      .returning({ id: leaveTypeChanges.id });
    if (!done.length) return false;
    await applyToType(tx, leaveTypeId, values);
    return true;
  });
}

/**
 * A change made by the system (a setting raised back to the Labour Act's
 * minimum): recorded as approved and applied at once, with the reason.
 */
export async function recordSystemChange(p: { leaveTypeId: string; before: Partial<PolicyValues>; after: Partial<PolicyValues>; reason: string; today: string; exceptionId?: string | null }): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Two requests can find the same setting below the minimum: lock the type and record it once.
    const [current] = await tx.select().from(leaveTypes).where(eq(leaveTypes.id, p.leaveTypeId)).for("update");
    if (!current) return false;
    const target = columnsFor(p.after) as Record<string, unknown>;
    if (Object.entries(target).every(([k, v]) => sameValue((current as Record<string, unknown>)[k], v))) return false;
    const at = new Date();
    const [row] = await tx
      .insert(leaveTypeChanges)
      .values({
        leaveTypeId: p.leaveTypeId,
        before: p.before,
        after: p.after,
        reason: p.reason,
        applies: "approval",
        effectiveFrom: p.today,
        status: "approved",
        source: "system",
        exceptionId: p.exceptionId ?? null,
        approvalRoute: "not_required",
        approvalType: "none",
        decidedAt: at,
        appliedAt: at,
      })
      .returning({ id: leaveTypeChanges.id });
    await tx.insert(approvalActions).values({ module: MODULE, requestId: row.id, level: 0, actorId: null, action: "not_required", note: p.reason, createdAt: at });
    await applyToType(tx, p.leaveTypeId, p.after);
    return true;
  });
}

/** Column values compared as numbers when both are numbers ("90.0" and 90 are the same). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  const x = Number(a);
  const y = Number(b);
  if (typeof a !== "boolean" && typeof b !== "boolean" && Number.isFinite(x) && Number.isFinite(y)) return x === y;
  return String(a) === String(b);
}

/**
 * People who can approve leave policy changes: active users with a
 * company-wide role that is an administrator role or has Leave types →
 * Approve. Platform support is never a user here.
 */
export async function findPolicyApprovers(): Promise<{ userId: string; name: string; employeeId: string | null }[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ id: users.id, name: users.name, email: users.email, employeeId: users.employeeId, fullName: employees.fullName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(
      and(
        eq(users.isActive, true),
        eq(roles.scopeType, "GLOBAL"),
        or(inArray(roles.slug, ["system_admin", "office_admin"]), and(eq(permissions.module, MODULE), eq(permissions.action, "APPROVE")))
      )
    );
  const seen = new Map<string, { userId: string; name: string; employeeId: string | null }>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, { userId: r.id, name: r.name || r.fullName || r.email, employeeId: r.employeeId ?? null });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The platform's exceptions for this company (read-only: only platform routes write them). */
export async function findExceptions(): Promise<PolicyException[]> {
  const rows = await (await getDb()).select().from(leavePolicyExceptions).orderBy(asc(leavePolicyExceptions.validFrom));
  return rows.map((r) => ({
    id: r.id,
    statutoryCode: r.statutoryCode,
    setting: r.setting as PolicySetting,
    value: r.value === null ? null : Number(r.value),
    legalBasis: r.legalBasis,
    reference: r.reference,
    validFrom: String(r.validFrom).slice(0, 10),
    validUntil: r.validUntil ? String(r.validUntil).slice(0, 10) : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
  }));
}
