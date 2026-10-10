import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { ModuleType } from "@/lib/types/role";
import { getDb } from "@/lib/db";
import {
  approvalActions,
  employeeSalaryHeads,
  employeeSalaryMap,
  employees,
  fiscalYears,
  payrollRuns,
  payrollSlips,
  permissions,
  rolePermissions,
  roles,
  salaryChangeBatches,
  salaryTemplates,
  systemConfig,
  userRoles,
  users,
} from "@/lib/db/schema";
import { latestApproved } from "@/lib/engines/salary-structure.engine";
import { parsePolicy } from "@/lib/engines/approval.engine";
import { readRules } from "@/lib/engines/approval-rules.engine";
import type { ApprovalActionKind, ApprovalFlow, ApprovalPolicy, ApprovalRoute, ApprovalRule, ApproverInfo } from "@/lib/types/approval";
import type { BatchKind, BatchStatus, TemplateInput } from "@/lib/types/salary-structure";

const MODULE = "SALARY_MAPPING";

/** One step for the approval timeline. */
export interface NewApprovalAction {
  level: number;
  actorId: string | null;
  onBehalfOf?: string | null;
  action: ApprovalActionKind;
  note?: string | null;
}

// Salary structure (4.4): revisions (rows of employee_salary_map), change
// batches, templates and the approval setting. Approved revisions are never
// edited or deleted; is_active marks each employee's latest approved one.

export type RevisionRow = typeof employeeSalaryMap.$inferSelect;
export type BatchRowDb = typeof salaryChangeBatches.$inferSelect;
export type TemplateRowDb = typeof salaryTemplates.$inferSelect;

export interface StoredHead {
  salaryMapId: string;
  payHeadId: string;
  amount: number;
}

export async function findRevisions(employeeIds: string[] | null): Promise<{ revisions: RevisionRow[]; heads: StoredHead[] }> {
  const db = await getDb();
  if (employeeIds && employeeIds.length === 0) return { revisions: [], heads: [] };
  const revisions = await db
    .select()
    .from(employeeSalaryMap)
    .where(employeeIds ? inArray(employeeSalaryMap.employeeId, employeeIds) : undefined)
    .orderBy(asc(employeeSalaryMap.effectiveFrom), asc(employeeSalaryMap.createdAt));
  const ids = revisions.map((r) => r.id);
  const heads = ids.length
    ? (
        await db
          .select({ salaryMapId: employeeSalaryHeads.salaryMapId, payHeadId: employeeSalaryHeads.payHeadId, amount: employeeSalaryHeads.amount })
          .from(employeeSalaryHeads)
          .where(inArray(employeeSalaryHeads.salaryMapId, ids))
      ).map((h) => ({ ...h, amount: Number(h.amount) || 0 }))
    : [];
  return { revisions, heads };
}

/** Every employee in each batch (all of them, whatever the reader's scope): batchId -> employee ids. */
export async function findBatchEmployeeIds(batchId?: string): Promise<Map<string, string[]>> {
  const rows = await (await getDb())
    .select({ batchId: employeeSalaryMap.batchId, employeeId: employeeSalaryMap.employeeId })
    .from(employeeSalaryMap)
    .where(batchId ? eq(employeeSalaryMap.batchId, batchId) : sql`${employeeSalaryMap.batchId} IS NOT NULL`);
  const out = new Map<string, string[]>();
  for (const r of rows) if (r.batchId) out.set(r.batchId, [...(out.get(r.batchId) ?? []), r.employeeId]);
  return out;
}

export async function findBatches(): Promise<BatchRowDb[]> {
  return (await getDb()).select().from(salaryChangeBatches).orderBy(desc(salaryChangeBatches.createdAt));
}

export async function findBatchById(id: string): Promise<BatchRowDb | null> {
  const rows = await (await getDb()).select().from(salaryChangeBatches).where(eq(salaryChangeBatches.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Display names of users (preparers and approvers). */
export async function findUserNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await (await getDb()).select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r.name || r.email]));
}

/** The fiscal year a date falls in (else the active one). */
export async function fiscalYearFor(dateIso: string): Promise<string> {
  const db = await getDb();
  const all = await db.select({ id: fiscalYears.id, start: fiscalYears.startDateAD, end: fiscalYears.endDateAD, status: fiscalYears.status }).from(fiscalYears);
  const d = new Date(`${dateIso}T00:00:00`);
  const hit = all.find((f) => f.start <= d && d <= f.end) ?? all.find((f) => f.status?.toLowerCase() === "active") ?? all[0];
  if (!hit) throw new Error("No fiscal year exists yet. Create one in Setup first.");
  return hit.id;
}

export interface NewRevision {
  employeeId: string;
  basic: number;
  gradeCount: number;
  gradeAmount: number;
  gradeManual: boolean;
  netAmount: number;
  heads: { payHeadId: string; amount: number }[];
}

/**
 * Saves a change batch and its revisions in one transaction. Approved at once
 * (approval off, or a hire's first structure): the revisions become current
 * and the employees' basic and grade follow.
 */
export async function createBatch(params: {
  kind: BatchKind;
  effectiveFrom: string;
  reason: string;
  monthlyChange: number;
  preparedBy: string | null;
  /** How it counts at once; null: it waits for approval. */
  approvedRoute: ApprovalRoute | null;
  /** The flow fixed on it (type "none" when no approval applied) and the level waiting. */
  approvalType: "none" | ApprovalFlow["type"];
  flow?: ApprovalFlow;
  currentLevel?: number;
  /** Timeline steps written with it (submitted, skipped levels, final approve …). */
  actions: NewApprovalAction[];
  /** Who approved it at once (Final approve: the administrator; otherwise the preparer). */
  approvedBy?: string | null;
  revisions: NewRevision[];
}): Promise<string> {
  const approved = params.approvedRoute !== null;
  const approver = params.approvedBy ?? params.preparedBy;
  const fiscalYearId = await fiscalYearFor(params.effectiveFrom);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const status: BatchStatus = approved ? "approved" : "pending";
    const [batch] = await tx
      .insert(salaryChangeBatches)
      .values({
        kind: params.kind,
        effectiveFrom: params.effectiveFrom,
        reason: params.reason,
        status,
        employeeCount: params.revisions.length,
        monthlyChange: String(params.monthlyChange),
        preparedBy: params.preparedBy,
        decidedBy: approved ? approver : null,
        decidedAt: approved ? now : null,
        approvalRoute: params.approvedRoute,
        approvalType: params.approvalType,
        approvalLevels: params.flow?.levels ?? [],
        currentLevel: approved ? 0 : params.currentLevel ?? 0,
      })
      .returning({ id: salaryChangeBatches.id });
    for (const r of params.revisions) {
      const [rev] = await tx
        .insert(employeeSalaryMap)
        .values({
          employeeId: r.employeeId,
          fiscalYearId,
          effectiveFrom: params.effectiveFrom,
          basicSalary: String(r.basic),
          gradePercent: "0",
          gradeCount: r.gradeCount,
          gradeAmount: String(r.gradeAmount),
          gradeManual: r.gradeManual,
          netAmount: String(r.netAmount),
          createdBy: params.preparedBy,
          isActive: false,
          status,
          batchId: batch.id,
          reason: params.reason,
          approvedBy: approved ? approver : null,
          approvedAt: approved ? now : null,
        })
        .returning({ id: employeeSalaryMap.id });
      if (r.heads.length) {
        await tx.insert(employeeSalaryHeads).values(r.heads.map((h) => ({ salaryMapId: rev.id, payHeadId: h.payHeadId, amount: String(h.amount), isChangeable: true })));
      }
    }
    if (params.actions.length) {
      await tx.insert(approvalActions).values(
        params.actions.map((a, i) => ({ module: MODULE, requestId: batch.id, level: a.level, actorId: a.actorId, onBehalfOf: a.onBehalfOf ?? null, action: a.action, note: a.note ?? null, createdAt: new Date(now.getTime() + i) }))
      );
    }
    if (approved) await refreshCurrent(tx, params.revisions.map((r) => r.employeeId));
    return batch.id;
  });
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/**
 * Marks each employee's latest approved revision as current and copies its
 * basic and grade to the employee record (one owner for pay).
 */
async function refreshCurrent(tx: Tx, employeeIds: string[]) {
  const ids = [...new Set(employeeIds)];
  if (!ids.length) return;
  const rows = await tx
    .select({ id: employeeSalaryMap.id, employeeId: employeeSalaryMap.employeeId, effectiveFrom: employeeSalaryMap.effectiveFrom, status: employeeSalaryMap.status, createdAt: employeeSalaryMap.createdAt, isActive: employeeSalaryMap.isActive, basic: employeeSalaryMap.basicSalary, gradeCount: employeeSalaryMap.gradeCount, gradeAmount: employeeSalaryMap.gradeAmount, gradeManual: employeeSalaryMap.gradeManual })
    .from(employeeSalaryMap)
    .where(inArray(employeeSalaryMap.employeeId, ids));
  for (const employeeId of ids) {
    const mine = rows.filter((r) => r.employeeId === employeeId);
    const current = latestApproved(mine);
    if (!current) continue;
    const wrong = mine.filter((r) => r.isActive !== (r.id === current.id)).map((r) => r.id);
    if (wrong.length) {
      await tx.update(employeeSalaryMap).set({ isActive: false, updatedAt: new Date() }).where(and(eq(employeeSalaryMap.employeeId, employeeId), eq(employeeSalaryMap.isActive, true)));
      await tx.update(employeeSalaryMap).set({ isActive: true, updatedAt: new Date() }).where(eq(employeeSalaryMap.id, current.id));
    }
    await tx
      .update(employees)
      .set({ basicSalary: current.basic, gradeCount: current.gradeCount, gradeAmount: current.gradeAmount, gradeManual: current.gradeManual, updatedAt: new Date() })
      .where(eq(employees.id, employeeId));
  }
}

/**
 * One step on a pending batch: a level approved (the next level now waits),
 * or the batch approved, rejected or withdrawn (its revisions follow). It
 * applies only while the batch is still pending at the level the person saw,
 * so two people deciding at once cannot both win; null when it did not apply.
 */
export async function decideBatch(params: {
  batchId: string;
  expectedLevel: number;
  next: { status: BatchStatus; currentLevel: number; route: ApprovalRoute | null };
  actorId: string;
  action: NewApprovalAction;
  note: string | null;
}): Promise<string[] | null> {
  const db = await getDb();
  const { batchId, next } = params;
  const decision = next.status;
  return db.transaction(async (tx) => {
    const now = new Date();
    const finished = decision !== "pending";
    const updated = await tx
      .update(salaryChangeBatches)
      .set(
        finished
          ? { status: decision, currentLevel: 0, decidedBy: params.actorId, decidedAt: now, decisionNote: params.note, approvalRoute: decision === "approved" ? next.route : null }
          : { currentLevel: next.currentLevel }
      )
      .where(and(eq(salaryChangeBatches.id, batchId), eq(salaryChangeBatches.status, "pending"), eq(salaryChangeBatches.currentLevel, params.expectedLevel)))
      .returning({ id: salaryChangeBatches.id });
    if (!updated.length) return null;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: batchId, level: params.action.level, actorId: params.action.actorId, onBehalfOf: params.action.onBehalfOf ?? null, action: params.action.action, note: params.action.note ?? null, createdAt: now });
    if (!finished) return [];
    const revs = await tx
      .update(employeeSalaryMap)
      .set({ status: decision, ...(decision === "approved" ? { approvedBy: params.actorId, approvedAt: now } : {}), updatedAt: now })
      .where(and(eq(employeeSalaryMap.batchId, batchId), eq(employeeSalaryMap.status, "pending")))
      .returning({ employeeId: employeeSalaryMap.employeeId });
    const employeeIds = revs.map((r) => r.employeeId);
    if (decision === "approved") await refreshCurrent(tx, employeeIds);
    return employeeIds;
  });
}

// ---------------------------------------------------------------------------
// Payroll: the revision in force for a month
// ---------------------------------------------------------------------------

/** Approved revisions effective on or before a date, for some employees (payroll picks per employee). */
export async function findApprovedUpTo(employeeIds: string[], onDate: string): Promise<RevisionRow[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select()
    .from(employeeSalaryMap)
    .where(and(inArray(employeeSalaryMap.employeeId, employeeIds), eq(employeeSalaryMap.status, "approved"), lte(employeeSalaryMap.effectiveFrom, onDate)));
}

// ---------------------------------------------------------------------------
// Templates and the approval setting
// ---------------------------------------------------------------------------

export async function findTemplates(): Promise<TemplateRowDb[]> {
  return (await getDb()).select().from(salaryTemplates).orderBy(asc(salaryTemplates.name));
}

export async function saveTemplate(id: string | null, input: TemplateInput): Promise<TemplateRowDb> {
  const db = await getDb();
  const values = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    levelCodes: input.levelCodes,
    designationIds: input.designationIds,
    basicMode: input.basicMode,
    basicAmount: String(input.basicAmount || 0),
    scheme: input.scheme,
    heads: input.heads,
  };
  const [row] = id
    ? await db.update(salaryTemplates).set({ ...values, updatedAt: new Date() }).where(eq(salaryTemplates.id, id)).returning()
    : await db.insert(salaryTemplates).values({ ...values, isActive: true }).returning();
  return row;
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  await (await getDb()).update(salaryTemplates).set({ isActive: active, updatedAt: new Date() }).where(eq(salaryTemplates.id, id));
}

/** Deletes a template; returns it, or null when there is none with that id. */
export async function deleteTemplate(id: string): Promise<TemplateRowDb | null> {
  const [row] = await (await getDb()).delete(salaryTemplates).where(eq(salaryTemplates.id, id)).returning();
  return row ?? null;
}

const POLICY_KEY = "approvals.salaryRevision";
const LEGACY_KEY = "salaryRevision.requireApproval";

/** The company's approval setting for salary changes (default: simple). */
export async function getApprovalPolicy(): Promise<ApprovalPolicy> {
  const rows = await (await getDb()).select({ key: systemConfig.key, value: systemConfig.value }).from(systemConfig).where(inArray(systemConfig.key, [POLICY_KEY, LEGACY_KEY]));
  const stored = rows.find((r) => r.key === POLICY_KEY)?.value;
  let parsed: unknown = null;
  try {
    parsed = stored ? JSON.parse(stored) : null;
  } catch {
    parsed = null;
  }
  return parsePolicy(parsed, rows.find((r) => r.key === LEGACY_KEY)?.value ?? null);
}

// 4.12d: custom rules for salary changes, read in order (the first that applies decides).
const RULES_KEY = "approvals.salaryRevision.rules";

/** The custom rules and the version they were read at (the last save; "none" before any). */
export async function getApprovalRules(): Promise<{ rules: ApprovalRule[]; version: string }> {
  const [row] = await (await getDb()).select({ value: systemConfig.value, updatedAt: systemConfig.updatedAt }).from(systemConfig).where(eq(systemConfig.key, RULES_KEY)).limit(1);
  if (!row) return { rules: [], version: "none" };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    parsed = null;
  }
  return { rules: readRules(parsed), version: row.updatedAt.toISOString() };
}

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505");

/** Replaces the rules when they are still at `version` (false: someone saved them meanwhile). */
export async function replaceApprovalRules(rules: readonly ApprovalRule[], version: string): Promise<boolean> {
  const value = JSON.stringify(rules);
  try {
    return await (await getDb()).transaction(async (tx) => {
      const [row] = await tx.select({ updatedAt: systemConfig.updatedAt }).from(systemConfig).where(eq(systemConfig.key, RULES_KEY)).for("update");
      if (!row) {
        if (version !== "none") return false;
        await tx.insert(systemConfig).values({ key: RULES_KEY, value, dataType: "json" });
        return true;
      }
      if (row.updatedAt.toISOString() !== version) return false;
      await tx.update(systemConfig).set({ value, dataType: "json", updatedAt: new Date() }).where(eq(systemConfig.key, RULES_KEY));
      return true;
    });
  } catch (error) {
    // Two first saves at the same moment: the second finds the row.
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function setApprovalPolicy(policy: ApprovalPolicy): Promise<void> {
  const value = JSON.stringify({ type: policy.type, levels: policy.levels });
  await (await getDb())
    .insert(systemConfig)
    .values({ key: POLICY_KEY, value, dataType: "json" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, dataType: "json", updatedAt: new Date() } });
}

/**
 * Every user, with whether they can approve a module's requests (office / system
 * administrators have full access; others need a role with the module's Approve —
 * Salary structure unless another module is named, e.g. LOANS), their linked
 * employee and any delegation while away.
 */
export async function findApprovers(module: ModuleType = MODULE): Promise<ApproverInfo[]> {
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
      .where(or(inArray(roles.slug, ["system_admin", "office_admin"]), and(eq(permissions.module, module), eq(permissions.action, "APPROVE")))),
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

/** Timeline steps of some batches (all when no ids), oldest first. */
export async function findApprovalActions(requestIds?: string[]) {
  if (requestIds && !requestIds.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), requestIds ? inArray(approvalActions.requestId, requestIds) : undefined))
    .orderBy(asc(approvalActions.createdAt));
}

// ---------------------------------------------------------------------------
// Payroll months a change would reach
// ---------------------------------------------------------------------------

/** Per employee, the latest pay period end with an approved or locked payslip (AD date). */
export async function findFinalisedUntil(employeeIds: string[] | null): Promise<Record<string, string>> {
  if (employeeIds && !employeeIds.length) return {};
  const rows = await (await getDb())
    .select({ employeeId: payrollSlips.employeeId, until: sql<string>`max(${payrollRuns.payPeriodEndDate})::text` })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollRuns.status, ["APPROVED", "LOCKED"]), employeeIds ? inArray(payrollSlips.employeeId, employeeIds) : undefined))
    .groupBy(payrollSlips.employeeId);
  return Object.fromEntries(rows.map((r) => [r.employeeId, String(r.until).slice(0, 10)]));
}

/** Draft or in-review payroll months (BS) that include these employees and end on or after a date: they need recalculating. */
export async function findOpenRunsFrom(effectiveFrom: string, employeeIds: string[]): Promise<{ month: number; year: number }[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .selectDistinct({ month: payrollRuns.payPeriodMonth, year: payrollRuns.payPeriodYear })
    .from(payrollRuns)
    .innerJoin(payrollSlips, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollRuns.status, ["DRAFT", "UNDER_REVIEW"]), gte(payrollRuns.payPeriodEndDate, effectiveFrom), inArray(payrollSlips.employeeId, employeeIds)))
    .orderBy(asc(payrollRuns.payPeriodYear), asc(payrollRuns.payPeriodMonth));
}

/** Pending revisions of some employees (a new change waits until these are decided). */
export async function countPendingFor(employeeIds: string[]): Promise<Map<string, string>> {
  if (!employeeIds.length) return new Map();
  const rows = await (await getDb())
    .select({ employeeId: employeeSalaryMap.employeeId, batchId: employeeSalaryMap.batchId })
    .from(employeeSalaryMap)
    .where(and(inArray(employeeSalaryMap.employeeId, employeeIds), eq(employeeSalaryMap.status, "pending")));
  return new Map(rows.map((r) => [r.employeeId, r.batchId ?? ""]));
}


/**
 * Employees whose current salary is still only the basic + grade saved with
 * the employee form (a hire revision with no pay heads): their structure is
 * to be set up in Salary structure (4.4b). Same rule as needsSetup().
 */
export async function employeesNeedingSetup(): Promise<Set<string>> {
  const db = await getDb();
  const approved = await db
    .select({ id: employeeSalaryMap.id, employeeId: employeeSalaryMap.employeeId, batchId: employeeSalaryMap.batchId, effectiveFrom: employeeSalaryMap.effectiveFrom, status: employeeSalaryMap.status, createdAt: employeeSalaryMap.createdAt })
    .from(employeeSalaryMap)
    .where(eq(employeeSalaryMap.status, "approved"));
  const byEmployee = new Map<string, typeof approved>();
  for (const r of approved) byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  const current = [...byEmployee.values()].map((list) => latestApproved(list)).filter((r): r is (typeof approved)[number] => !!r && !!r.batchId);
  if (!current.length) return new Set();
  const hires = new Set(
    (await db.select({ id: salaryChangeBatches.id }).from(salaryChangeBatches).where(and(eq(salaryChangeBatches.kind, "hire"), inArray(salaryChangeBatches.id, [...new Set(current.map((r) => r.batchId!))])))).map((b) => b.id)
  );
  const candidates = current.filter((r) => hires.has(r.batchId!));
  if (!candidates.length) return new Set();
  const withHeads = new Set(
    (await db.selectDistinct({ id: employeeSalaryHeads.salaryMapId }).from(employeeSalaryHeads).where(inArray(employeeSalaryHeads.salaryMapId, candidates.map((r) => r.id)))).map((h) => h.id)
  );
  return new Set(candidates.filter((r) => !withHeads.has(r.id)).map((r) => r.employeeId));
}
