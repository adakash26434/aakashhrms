import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { approvalActions, employeeBank, employeeDetailChanges, employeePersonal, employees, payrollRuns, payrollSlips } from "@/lib/db/schema";

// Sensitive employee details (4.8 / F13): queries only. The rules (what changes, who decides,
// the stale check) are in lib/engines/employee-detail.engine.ts; the service runs the decision
// transaction with the functions below.

export const MODULE = "EMPLOYEE_DETAILS";

export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
export type ChangeRow = typeof employeeDetailChanges.$inferSelect;

export interface ChangeWithEmployee extends ChangeRow {
  employeeName: string;
  employeeCode: string;
}

export async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

// ---- reads ---------------------------------------------------------------------------------

/** The change waiting for this employee, if any (at most one). */
export async function findPending(employeeId: string): Promise<ChangeRow | null> {
  const [row] = await (await getDb())
    .select()
    .from(employeeDetailChanges)
    .where(and(eq(employeeDetailChanges.employeeId, employeeId), eq(employeeDetailChanges.status, "pending")))
    .limit(1);
  return row ?? null;
}

/** Changes about employees within a scope condition (buildEmployeeScopeCondition), newest first. */
export async function findChanges(opts: { scope?: SQL; id?: string; status?: string; employeeId?: string; limit?: number }): Promise<ChangeWithEmployee[]> {
  const rows = await (await getDb())
    .select({ change: employeeDetailChanges, employeeName: employees.fullName, employeeCode: employees.employeeCode })
    .from(employeeDetailChanges)
    .innerJoin(employees, eq(employees.id, employeeDetailChanges.employeeId))
    .where(
      and(
        opts.scope,
        opts.id ? eq(employeeDetailChanges.id, opts.id) : undefined,
        opts.status ? eq(employeeDetailChanges.status, opts.status) : undefined,
        opts.employeeId ? eq(employeeDetailChanges.employeeId, opts.employeeId) : undefined,
      ),
    )
    .orderBy(desc(employeeDetailChanges.preparedAt))
    .limit(opts.limit ?? 300);
  return rows.map((r) => ({ ...r.change, employeeName: r.employeeName, employeeCode: r.employeeCode }));
}

/** Timeline steps of some changes, oldest first. */
export async function findActions(changeIds: string[]) {
  if (!changeIds.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, changeIds)))
    .orderBy(asc(approvalActions.createdAt));
}

/** The approved changes to bank details of these employees, newest first (for the variance notes). */
export async function approvedChangesFor(employeeIds: string[]): Promise<ChangeRow[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select()
    .from(employeeDetailChanges)
    .where(and(inArray(employeeDetailChanges.employeeId, employeeIds), eq(employeeDetailChanges.status, "approved")))
    .orderBy(desc(employeeDetailChanges.decidedAt));
}

/** The primary bank account on each employee's record now. */
export async function primaryAccounts(employeeIds: string[]): Promise<Map<string, string>> {
  if (!employeeIds.length) return new Map();
  const rows = await (await getDb())
    .select({ employeeId: employeeBank.employeeId, accountNumber: employeeBank.accountNumber })
    .from(employeeBank)
    .where(and(inArray(employeeBank.employeeId, employeeIds), eq(employeeBank.isPrimary, true)));
  return new Map(rows.map((r) => [r.employeeId, r.accountNumber]));
}

/** Runs past draft and not locked that pay this employee (they keep the payslip's bank details). */
export async function runsInReview(employeeId: string): Promise<{ id: string; month: number; year: number; status: string; runType: string }[]> {
  return (await getDb())
    .selectDistinct({ id: payrollRuns.id, month: payrollRuns.payPeriodMonth, year: payrollRuns.payPeriodYear, status: payrollRuns.status, runType: payrollRuns.runType })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollSlips.payrollRunId))
    .where(and(eq(payrollSlips.employeeId, employeeId), inArray(payrollRuns.status, ["UNDER_REVIEW", "APPROVED"])));
}

// ---- writes (inside the caller's transaction) -------------------------------------------------

export interface NewChange {
  employeeId: string;
  before: Record<string, string | boolean>;
  after: Record<string, string | boolean>;
  reason: string;
  preparedBy: string;
  /** Applied with the save (approvals off, or a company administrator): approved at once. */
  appliedRoute: "not_required" | "final_approve" | null;
}

/** Records a change and its first timeline steps; returns its id. */
export async function insertChangeTx(tx: Tx, c: NewChange): Promise<string> {
  const now = new Date();
  const applied = c.appliedRoute !== null;
  const [row] = await tx
    .insert(employeeDetailChanges)
    .values({
      employeeId: c.employeeId,
      before: c.before,
      after: c.after,
      reason: c.reason,
      status: applied ? "approved" : "pending",
      preparedBy: c.preparedBy,
      preparedAt: now,
      decidedBy: applied ? c.preparedBy : null,
      decidedAt: applied ? now : null,
      approvalRoute: c.appliedRoute,
      appliedAt: applied ? now : null,
    })
    .returning({ id: employeeDetailChanges.id });
  const steps: (typeof approvalActions.$inferInsert)[] = [{ module: MODULE, requestId: row.id, level: 0, actorId: c.preparedBy, action: "submitted", note: c.reason }];
  if (c.appliedRoute === "not_required") steps.push({ module: MODULE, requestId: row.id, level: 0, actorId: c.preparedBy, action: "not_required", note: "Approvals for employee details are off" });
  if (c.appliedRoute === "final_approve") steps.push({ module: MODULE, requestId: row.id, level: 0, actorId: c.preparedBy, action: "final_approved", note: "Saved by a company administrator" });
  await tx.insert(approvalActions).values(steps);
  return row.id;
}

/** Claim-first decision: moves a waiting change on only if it is still waiting. */
export async function claimTx(
  tx: Tx,
  id: string,
  d: { status: "approved" | "rejected" | "withdrawn"; actorId: string; note: string | null; route: string | null },
): Promise<ChangeRow | null> {
  const now = new Date();
  const [row] = await tx
    .update(employeeDetailChanges)
    .set({ status: d.status, decidedBy: d.actorId, decidedAt: now, decisionNote: d.note, approvalRoute: d.route, appliedAt: d.status === "approved" ? now : null })
    .where(and(eq(employeeDetailChanges.id, id), eq(employeeDetailChanges.status, "pending")))
    .returning();
  return row ?? null;
}

export async function insertActionTx(tx: Tx, step: { requestId: string; actorId: string; action: string; note: string | null }): Promise<void> {
  await tx.insert(approvalActions).values({ module: MODULE, requestId: step.requestId, level: 0, actorId: step.actorId, action: step.action, note: step.note });
}

/** The record's sensitive values now, read with row locks so nothing changes under the decision. */
export async function currentValuesTx(tx: Tx, employeeId: string) {
  const [emp] = await tx.select({ taxStatus: employees.taxStatus, isDisabled: employees.isDisabled }).from(employees).where(eq(employees.id, employeeId)).for("update");
  if (!emp) return null;
  const [personal] = await tx.select({ panNumber: employeePersonal.panNumber }).from(employeePersonal).where(eq(employeePersonal.employeeId, employeeId)).for("update");
  const [bank] = await tx
    .select({ id: employeeBank.id, bankName: employeeBank.bankName, bankBranch: employeeBank.branchName, bankAccountNumber: employeeBank.accountNumber })
    .from(employeeBank)
    .where(and(eq(employeeBank.employeeId, employeeId), eq(employeeBank.isPrimary, true)))
    .for("update");
  return {
    taxStatus: emp.taxStatus,
    isDisabled: emp.isDisabled,
    panNumber: personal?.panNumber ?? "",
    bankName: bank?.bankName ?? "",
    bankBranch: bank?.bankBranch ?? "",
    bankAccountNumber: bank?.bankAccountNumber ?? "",
    bankRowId: bank?.id ?? null,
  };
}

/** Writes the approved values onto the record (only the fields the change holds). */
export async function writeValuesTx(
  tx: Tx,
  employeeId: string,
  bankRowId: string | null,
  values: { bankName?: string; bankBranch?: string; bankAccountNumber?: string; panNumber?: string; taxStatus?: string; isDisabled?: boolean },
): Promise<void> {
  if (values.taxStatus !== undefined || values.isDisabled !== undefined) {
    await tx
      .update(employees)
      .set({ ...(values.taxStatus !== undefined ? { taxStatus: values.taxStatus } : {}), ...(values.isDisabled !== undefined ? { isDisabled: values.isDisabled } : {}), updatedAt: new Date() })
      .where(eq(employees.id, employeeId));
  }
  if (values.panNumber !== undefined) {
    await tx.update(employeePersonal).set({ panNumber: values.panNumber || null }).where(eq(employeePersonal.employeeId, employeeId));
  }
  const bank = {
    ...(values.bankName !== undefined ? { bankName: values.bankName } : {}),
    ...(values.bankBranch !== undefined ? { branchName: values.bankBranch } : {}),
    ...(values.bankAccountNumber !== undefined ? { accountNumber: values.bankAccountNumber } : {}),
  };
  if (!Object.keys(bank).length) return;
  if (bankRowId) await tx.update(employeeBank).set(bank).where(eq(employeeBank.id, bankRowId));
  else await tx.insert(employeeBank).values({ employeeId, bankName: bank.bankName ?? "", branchName: bank.branchName ?? "", accountNumber: bank.accountNumber ?? "", isPrimary: true });
}

/**
 * A run sent back to draft takes the bank details now on its employees' records (a change approved
 * while it was in review reaches its payslips); returns how many payslips changed.
 */
export async function refreshRunBankDetails(runId: string): Promise<number> {
  const rows = await (await getDb())
    .update(payrollSlips)
    .set({ bankName: sql`${employeeBank.bankName}`, bankAccountNumber: sql`${employeeBank.accountNumber}`, updatedAt: new Date() })
    .from(employeeBank)
    .where(
      and(
        eq(payrollSlips.payrollRunId, runId),
        eq(employeeBank.employeeId, payrollSlips.employeeId),
        eq(employeeBank.isPrimary, true),
        or(ne(payrollSlips.bankAccountNumber, employeeBank.accountNumber), ne(payrollSlips.bankName, employeeBank.bankName)),
      ),
    )
    .returning({ id: payrollSlips.id });
  return rows.length;
}

/** Puts the record's bank details on the employee's payslips in draft runs; returns how many. */
export async function refreshDraftSlipsTx(tx: Tx, employeeId: string, bank: { bankName: string; bankAccountNumber: string }): Promise<number> {
  const drafts = tx.select({ id: payrollRuns.id }).from(payrollRuns).where(eq(payrollRuns.status, "DRAFT"));
  const rows = await tx
    .update(payrollSlips)
    .set({ bankName: bank.bankName, bankAccountNumber: bank.bankAccountNumber, updatedAt: new Date() })
    .where(and(eq(payrollSlips.employeeId, employeeId), inArray(payrollSlips.payrollRunId, drafts)))
    .returning({ id: payrollSlips.id });
  return rows.length;
}
