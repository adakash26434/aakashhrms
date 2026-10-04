import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  employeeSalaryHeads,
  employeeSalaryMap,
  employees,
  fiscalYears,
  salaryChangeBatches,
  salaryTemplates,
  systemConfig,
  users,
} from "@/lib/db/schema";
import { latestApproved } from "@/lib/engines/salary-structure.engine";
import type { BatchKind, BatchStatus, TemplateInput } from "@/lib/types/salary-structure";

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
  approved: boolean;
  revisions: NewRevision[];
}): Promise<string> {
  const fiscalYearId = await fiscalYearFor(params.effectiveFrom);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const status: BatchStatus = params.approved ? "approved" : "pending";
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
        decidedBy: params.approved ? params.preparedBy : null,
        decidedAt: params.approved ? now : null,
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
          approvedBy: params.approved ? params.preparedBy : null,
          approvedAt: params.approved ? now : null,
        })
        .returning({ id: employeeSalaryMap.id });
      if (r.heads.length) {
        await tx.insert(employeeSalaryHeads).values(r.heads.map((h) => ({ salaryMapId: rev.id, payHeadId: h.payHeadId, amount: String(h.amount), isChangeable: true })));
      }
    }
    if (params.approved) await refreshCurrent(tx, params.revisions.map((r) => r.employeeId));
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

/** Approve, reject or withdraw a pending batch (its revisions follow). */
export async function decideBatch(batchId: string, decision: "approved" | "rejected" | "withdrawn", userId: string, note: string | null): Promise<string[]> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(salaryChangeBatches)
      .set({ status: decision, decidedBy: userId, decidedAt: now, decisionNote: note })
      .where(and(eq(salaryChangeBatches.id, batchId), eq(salaryChangeBatches.status, "pending")))
      .returning({ id: salaryChangeBatches.id });
    if (!updated.length) return [];
    const revs = await tx
      .update(employeeSalaryMap)
      .set({ status: decision, ...(decision === "approved" ? { approvedBy: userId, approvedAt: now } : {}), updatedAt: now })
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

const APPROVAL_KEY = "salaryRevision.requireApproval";

/** "Salary changes need a second person's approval" (on unless switched off). */
export async function approvalRequired(): Promise<boolean> {
  const rows = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, APPROVAL_KEY)).limit(1);
  return rows[0]?.value !== "false";
}

export async function setApprovalRequired(on: boolean): Promise<void> {
  await (await getDb())
    .insert(systemConfig)
    .values({ key: APPROVAL_KEY, value: String(on), dataType: "boolean" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: String(on), updatedAt: new Date() } });
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

