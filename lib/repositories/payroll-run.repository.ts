import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { approvalActions, employees, payrollRuns, payrollSlips, permissions, rolePermissions, roles, systemConfig, userRoles, users } from "@/lib/db/schema";
import { parsePolicy } from "@/lib/engines/approval.engine";
import { DEFAULT_VARIANCE_PCT, normalizeThreshold, runTotals } from "@/lib/engines/payroll-run.engine";
import type { ApprovalActionKind, ApprovalPolicy, ApprovalRoute, ApproverInfo } from "@/lib/types/approval";
import type { PayrollRun, PayrollRunStatus, PayrollSlip } from "@/lib/types/payroll";
import type { RunVariance } from "@/lib/types/payroll-run";

// Payroll run (4.8a): the approval policy for pay runs, the approvers, the
// run's flow and variance, its timeline (approval_actions, module
// PAYROLL_RUN) and the totals, always recomputed from the payslips.

export const MODULE = "PAYROLL_RUN";
const POLICY_KEY = "approvals.payrollRun";
const THRESHOLD_KEY = "payroll.varianceThreshold";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The company's approval setting for pay runs (default: simple) and the variance threshold. */
export async function findSettings(): Promise<{ policy: ApprovalPolicy; thresholdPct: number }> {
  const rows = await (await getDb()).select({ key: systemConfig.key, value: systemConfig.value }).from(systemConfig).where(inArray(systemConfig.key, [POLICY_KEY, THRESHOLD_KEY]));
  const stored = rows.find((r) => r.key === POLICY_KEY)?.value;
  let parsed: unknown = null;
  try {
    parsed = stored ? JSON.parse(stored) : null;
  } catch {
    parsed = null;
  }
  const threshold = rows.find((r) => r.key === THRESHOLD_KEY)?.value;
  return { policy: parsePolicy(parsed), thresholdPct: threshold ? normalizeThreshold(threshold) : DEFAULT_VARIANCE_PCT };
}

async function upsertConfig(key: string, value: string, dataType: string) {
  await (await getDb())
    .insert(systemConfig)
    .values({ key, value, dataType })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, dataType, updatedAt: new Date() } });
}

export async function setApprovalPolicy(policy: ApprovalPolicy): Promise<void> {
  await upsertConfig(POLICY_KEY, JSON.stringify({ type: policy.type, levels: policy.levels }), "json");
}

export async function setThreshold(pct: number): Promise<void> {
  await upsertConfig(THRESHOLD_KEY, String(pct), "number");
}

/** Every user, with whether they can approve pay runs (administrators, or a role with Payroll review → Approve). */
export async function findApprovers(): Promise<ApproverInfo[]> {
  const db = await getDb();
  const [people, grants] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, employeeId: users.employeeId, isActive: users.isActive, delegatedTo: users.delegatedToUserId, delegatedUntil: users.delegatedUntil, fullName: employees.fullName })
      .from(users)
      .leftJoin(employees, eq(users.employeeId, employees.id)),
    db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(or(inArray(roles.slug, ["system_admin", "office_admin"]), and(eq(permissions.module, "PAYROLL_REVIEW"), eq(permissions.action, "APPROVE")))),
  ]);
  const can = new Set(grants.map((g) => g.userId));
  return people
    .map((u) => ({
      userId: u.id,
      name: u.name || u.fullName || u.email,
      employeeId: u.employeeId ?? null,
      active: u.isActive,
      canApprove: can.has(u.id),
      delegatedTo: u.delegatedTo ?? null,
      delegatedUntil: u.delegatedUntil ? u.delegatedUntil.toISOString() : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const periodKey = (year: number, month: number) => year * 100 + month;

/** The latest LOCKED run before a period (any branch): the variance base. */
export async function findLastLockedRunBefore(year: number, month: number): Promise<PayrollRun | null> {
  const key = periodKey(year, month);
  const [row] = await (await getDb())
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.status, "LOCKED"), lt(sql`${payrollRuns.payPeriodYear} * 100 + ${payrollRuns.payPeriodMonth}`, key)))
    .orderBy(desc(sql`${payrollRuns.payPeriodYear} * 100 + ${payrollRuns.payPeriodMonth}`), desc(payrollRuns.lockedAt))
    .limit(1);
  return row ? ({ ...row, status: row.status as PayrollRunStatus, departmentIds: row.departmentIds || null } as PayrollRun) : null;
}

/** The run for the month before a period, if any (pre-flight: "previous month not locked"). */
export async function findRunForPeriod(year: number, month: number): Promise<PayrollRun | null> {
  const [row] = await (await getDb())
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.payPeriodYear, year), eq(payrollRuns.payPeriodMonth, month)))
    .orderBy(desc(payrollRuns.createdAt))
    .limit(1);
  return row ? ({ ...row, status: row.status as PayrollRunStatus, departmentIds: row.departmentIds || null } as PayrollRun) : null;
}

/** Payslips of some employees in one run (the variance base), by employee id. */
export async function findRunSlipsByEmployee(runId: string, employeeIds: string[]): Promise<Map<string, PayrollSlip>> {
  if (!employeeIds.length) return new Map();
  const rows = await (await getDb()).select().from(payrollSlips).where(and(eq(payrollSlips.payrollRunId, runId), inArray(payrollSlips.employeeId, employeeIds)));
  return new Map(rows.map((r) => [r.employeeId, { ...r, status: r.status as PayrollSlip["status"] } as PayrollSlip]));
}

/** The run's figures recomputed from its payslips (never trusted from a running sum). */
export async function recomputeTotals(runId: string, tx?: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0]): Promise<void> {
  const db = tx ?? (await getDb());
  const slips = await db.select().from(payrollSlips).where(eq(payrollSlips.payrollRunId, runId));
  const t = runTotals(slips);
  await db.update(payrollRuns).set({ ...t, updatedAt: new Date() }).where(eq(payrollRuns.id, runId));
}

/** Stores the variance review (flags and acknowledgements). */
export async function saveVariance(runId: string, variance: RunVariance): Promise<void> {
  await (await getDb()).update(payrollRuns).set({ variance, updatedAt: new Date() }).where(eq(payrollRuns.id, runId));
}

/**
 * Submits a DRAFT run: the approval flow is copied on, the status becomes
 * UNDER_REVIEW and the step is written to the timeline. False when the run
 * is no longer a draft (someone else moved it).
 */
export async function submit(params: { runId: string; userId: string; approvalType: "simple" | "multi_level"; levels: { level: number; userId: string; skipped?: "preparer" | "own_salary" | null }[]; currentLevel: number; note: string | null }): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .update(payrollRuns)
      .set({ status: "UNDER_REVIEW", approvalType: params.approvalType, approvalLevels: params.levels, currentLevel: params.currentLevel, approvalRoute: null, submittedBy: params.userId, submittedAt: now, updatedAt: now })
      .where(and(eq(payrollRuns.id, params.runId), eq(payrollRuns.status, "DRAFT")))
      .returning({ id: payrollRuns.id });
    if (!rows.length) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: params.runId, level: 0, actorId: params.userId, action: "submitted", note: params.note, createdAt: now });
    return true;
  });
}

/**
 * Records a decision on a run under review: approve (a level, or the whole
 * run), Final approve or reject (back to DRAFT with the reason). Only when
 * the run is still at the level the decision was made against.
 */
export async function decide(params: {
  runId: string;
  expectedLevel: number;
  status: PayrollRunStatus;
  currentLevel: number;
  route: ApprovalRoute | null;
  actorId: string;
  onBehalfOf: string | null;
  level: number;
  action: ApprovalActionKind;
  note: string | null;
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const set: Partial<typeof payrollRuns.$inferInsert> = { status: params.status, currentLevel: params.currentLevel, updatedAt: now };
    if (params.status === "APPROVED") {
      set.approvalRoute = params.route;
      set.reviewedBy = params.actorId;
      set.reviewedAt = now;
    }
    if (params.status === "DRAFT") {
      set.approvalType = null;
      set.approvalLevels = [];
      set.approvalRoute = null;
      set.notes = params.note;
    }
    const rows = await tx
      .update(payrollRuns)
      .set(set)
      .where(and(eq(payrollRuns.id, params.runId), eq(payrollRuns.status, "UNDER_REVIEW"), eq(payrollRuns.currentLevel, params.expectedLevel)))
      .returning({ id: payrollRuns.id });
    if (!rows.length) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: params.runId, level: params.level, actorId: params.actorId, onBehalfOf: params.onBehalfOf, action: params.action, note: params.note, createdAt: now });
    return true;
  });
}

/** The approval steps of some runs, oldest first. */
export async function findTimeline(runIds: string[]) {
  if (!runIds.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, runIds)))
    .orderBy(asc(approvalActions.createdAt));
}

/** Names of users (preparers, approvers) for the Runs grid. */
export async function findUserNames(ids: string[]): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return new Map();
  const rows = await (await getDb()).select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, clean));
  return new Map(rows.map((r) => [r.id, r.name || r.email]));
}
