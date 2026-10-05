'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import * as service from '@/lib/services/leave.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import type { LeavePreview, LeaveStatus, LedgerLine } from '@/lib/types/leave';

// Security plan S24 (4.6): every leave action checks a leave permission with
// the user's scope (branch / department), counts the days on the server,
// never lets anyone approve, cancel or adjust their own leave (S21, audited
// DENIED_SELF), audits what changed (ids and days), and returns safe
// messages. Support view (platform impersonation) can't decide leave.

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, string> };
type Ok<T = undefined> = T extends undefined ? { success: true } : { success: true; data: T };

const DECISIONS = ['approve', 'final_approve', 'reject', 'withdraw', 'cancel'] as const;
const MAX_BULK = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath('/timeAndLeave/leaves');
  revalidatePath('/timeAndLeave/attendance');
  revalidatePath('/dashboard');
  revalidatePath('/self-service');
}

/** The scope for reading leave: Leave requests → View, or Leave approvals → View. */
async function viewScope(): Promise<ScopeFilter> {
  try {
    return await checkPermissionWithScope('VIEW', 'LEAVE_APPLICATIONS');
  } catch {
    return checkPermissionWithScope('VIEW', 'LEAVE_APPROVALS');
  }
}

async function auditRefusal(error: unknown, scope: ScopeFilter | null, action: 'ADD' | 'EDIT' | 'APPROVE', module: 'LEAVE_APPLICATIONS' | 'LEAVE_APPROVALS', recordId: string) {
  if (!scope) return;
  if (error instanceof service.OwnLeaveError) await recordAuditLog({ userId: scope.userId, action, module, recordId, result: DENIED_SELF });
  else if (error instanceof service.OutOfScopeError) await recordAuditLog({ userId: scope.userId, action, module, recordId, result: 'DENIED_SCOPE' });
}

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.LeaveValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** What a request would take (days counted and skipped, pay, balance, problems). */
export async function previewLeaveAction(input: unknown): Promise<Ok<LeavePreview> | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('ADD', 'LEAVE_APPLICATIONS');
    return { success: true, data: await service.preview(input, { scope }) };
  } catch (error: unknown) {
    return fail(error, 'leave.preview');
  }
}

/** HR raises a request for someone in scope; it waits for approval like any other. */
export async function createLeaveRequestAction(input: unknown): Promise<Ok<{ id: string }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('ADD', 'LEAVE_APPLICATIONS');
    const r = await service.createRequest(input, { userId: scope.userId, source: 'hr', scope });
    await recordAuditLog({ userId: scope.userId, action: 'ADD', module: 'LEAVE_APPLICATIONS', recordId: r.id, result: 'SUCCESS', newValues: { employee: r.employeeId, days: r.days } });
    refresh();
    return { success: true, data: { id: r.id } };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'ADD', 'LEAVE_APPLICATIONS', 'request');
    return fail(error, 'leave.create');
  }
}

/**
 * Approve, Final approve, reject, withdraw or cancel (one or many). Who may
 * act is decided on the server: the employee's supervisor or Leave approvals
 * → Approve in scope; company administrators Final approve; never your own
 * leave. Cancelling approved leave also needs Leave requests → Edit or
 * Approve. Each is checked and audited on its own.
 */
export async function decideLeaveRequestsAction(
  ids: string[],
  decision: (typeof DECISIONS)[number],
  note?: string
): Promise<Ok<{ done: number; failed: { id: string; error: string }[] }> | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const list = Array.isArray(ids) ? [...new Set(ids.map(String))].filter((id) => UUID.test(id)).slice(0, MAX_BULK) : [];
    if (!list.length) throw new UserFacingError('Choose at least one leave request.');
    if (decision !== 'withdraw' && (await getImpersonationSession())) throw new UserFacingError('Support view cannot decide leave on behalf of the company.');
    const scope = await viewScope();
    const [canApprove, canEdit] = await Promise.all([hasPermission('APPROVE', 'LEAVE_APPROVALS'), hasPermission('EDIT', 'LEAVE_APPLICATIONS')]);
    const action = decision === 'withdraw' || decision === 'cancel' ? 'EDIT' : 'APPROVE';
    const leaveModule = action === 'EDIT' ? 'LEAVE_APPLICATIONS' : 'LEAVE_APPROVALS';
    let done = 0;
    const failed: { id: string; error: string }[] = [];
    for (const id of list) {
      try {
        const r = await service.decide(id, decision, note, { scope, userId: scope.userId, canApprove, canEdit });
        await recordAuditLog({ userId: scope.userId, action, module: leaveModule, recordId: id, result: 'SUCCESS', newValues: { decision, status: r.status, employee: r.employeeId } });
        done++;
      } catch (error) {
        await auditRefusal(error, scope, action, leaveModule, id);
        if (error instanceof UserFacingError) failed.push({ id, error: error.message });
        else if (error instanceof service.LeaveValidationError) failed.push({ id, error: Object.values(error.errors)[0] ?? 'Not changed.' });
        else throw error;
      }
    }
    if (done) refresh();
    if (!done && failed.length === 1) return { success: false, error: failed[0].error };
    return { success: true, data: { done, failed } };
  } catch (error: unknown) {
    return fail(error, 'leave.decide');
  }
}

/** HR adds days to a balance or takes them away, with a reason (never their own). */
export async function adjustLeaveBalanceAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'LEAVE_APPLICATIONS');
    const r = await service.adjustBalance(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'LEAVE_APPLICATIONS', recordId: r.employeeId, result: 'SUCCESS', newValues: { balanceAdjusted: r.days, leaveType: r.leaveTypeId } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    const id = input && typeof input === 'object' && typeof (input as { employeeId?: unknown }).employeeId === 'string' ? (input as { employeeId: string }).employeeId : 'balance';
    await auditRefusal(error, scope, 'EDIT', 'LEAVE_APPLICATIONS', id);
    return fail(error, 'leave.adjust');
  }
}

/** One person's ledger for the leave year (Balances pane). */
export async function getLeaveLedgerAction(employeeId: string): Promise<Ok<(LedgerLine & { createdByName: string | null })[]> | Fail> {
  await ensureTenantContext();
  try {
    if (typeof employeeId !== 'string' || !UUID.test(employeeId)) throw new UserFacingError('Employee not found.');
    const scope = await viewScope();
    return { success: true, data: await service.ledgerFor(employeeId, scope) };
  } catch (error: unknown) {
    return fail(error, 'leave.ledger');
  }
}

export type { LeaveStatus };
