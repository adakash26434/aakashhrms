'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as service from '@/lib/services/overtime.service';
import * as attendance from '@/lib/services/attendance.service';
import { POLICY_KEY } from '@/lib/repositories/overtime.repository';
import { UserFacingError, toActionError, type ActionFailure } from '@/lib/errors/action-error';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

// Security plan S54 (4.7): the overtime policy is a company administrator's
// control; overtime decisions check Attendance permissions with the user's
// scope, never let anyone decide their own overtime (S21, audited
// DENIED_SELF), audit every change (minutes and ids, not salaries) and
// return safe messages.

type Ok<T = undefined> = { success: true; data?: T };
type Fail = ActionFailure & { validationErrors?: Record<string, string> };

const DECISIONS = ['approve', 'final_approve', 'reject', 'withdraw'] as const;
const MAX_BULK = 200;

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.OvertimeValidationError || error instanceof attendance.AttendanceValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** Refusals worth auditing: own overtime (S21) and people outside the scope. */
async function auditRefusal(error: unknown, scope: ScopeFilter | null, action: 'ADD' | 'EDIT' | 'APPROVE', recordId: string) {
  if (!scope) return;
  if (error instanceof attendance.OwnAttendanceError) await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId, result: DENIED_SELF });
  else if (error instanceof attendance.OutOfScopeError) await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId, result: 'DENIED_SCOPE' });
}

function refresh() {
  revalidatePath('/timeAndLeave/attendance');
  revalidatePath('/dashboard');
}

/**
 * The company's overtime policy (rates, rounding, approval): a company
 * administrator's control. Never below the Labour Act (checked in the service).
 */
export async function saveOvertimePolicyAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'OT_RULES');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change the overtime policy.');
    if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
    const { before, after } = await service.savePolicy(input);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'OT_RULES', recordId: POLICY_KEY, result: 'SUCCESS', oldValues: { policy: before }, newValues: { policy: after } });
    revalidatePath('/timeAndLeave/policies');
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'overtime.policy');
  }
}

/**
 * Approve (all or part), Final approve, reject or withdraw overtime days, each
 * sent as `employeeId|date|source`. Who may act is decided on the server
 * (the employee's supervisor, Attendance → Approve in scope, a company
 * administrator's Final approve; never your own). Each is checked and audited
 * on its own. `minutes` (approve part) applies when one day is decided.
 */
export async function decideOvertimeAction(
  keys: string[],
  decision: (typeof DECISIONS)[number],
  input?: { minutes?: number | null; note?: string }
): Promise<Ok<{ done: number; failed: { key: string; error: string }[] }> | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const list = Array.isArray(keys) ? [...new Set(keys.map(String))].slice(0, MAX_BULK) : [];
    if (!list.length) throw new UserFacingError('Choose at least one overtime day.');
    const scope = await checkPermissionWithScope('VIEW', 'ATTENDANCE');
    const canApprove = await hasPermission('APPROVE', 'ATTENDANCE');
    const action = decision === 'withdraw' ? 'EDIT' : 'APPROVE';
    const raw = { note: input?.note, minutes: list.length === 1 ? input?.minutes : undefined };
    let done = 0;
    const failed: { key: string; error: string }[] = [];
    for (const key of list) {
      const recordId = `overtime:${key}`.slice(0, 120);
      try {
        const r = await attendance.decideOvertime(key, decision, raw, { scope, userId: scope.userId, canApprove });
        await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId, result: 'SUCCESS', newValues: { overtime: decision, status: r.status, minutes: r.minutes, employee: r.employeeId, date: r.date } });
        done++;
      } catch (error) {
        if (error instanceof attendance.OwnAttendanceError || error instanceof attendance.OutOfScopeError) await auditRefusal(error, scope, action, recordId);
        if (error instanceof UserFacingError) failed.push({ key, error: error.message });
        else if (error instanceof attendance.AttendanceValidationError) {
          if (list.length === 1) throw error;
          failed.push({ key, error: Object.values(error.errors)[0] ?? 'Not changed.' });
        } else throw error;
      }
    }
    if (done) refresh();
    if (!done && failed.length === 1) return { success: false, error: failed[0].error };
    return { success: true, data: { done, failed } };
  } catch (error: unknown) {
    return fail(error, 'overtime.decide');
  }
}

/** Overtime added by hand (worked without punches): it waits for the supervisor or an attendance approver. */
export async function addOvertimeAction(input: unknown): Promise<Ok<{ id: string }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('ADD', 'ATTENDANCE');
    const r = await attendance.addOvertime(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'ADD', module: 'ATTENDANCE', recordId: `overtime:${r.id}`, result: 'SUCCESS', newValues: { overtime: 'added', minutes: r.minutes, employee: r.employeeId, date: r.date } });
    refresh();
    return { success: true, data: { id: r.id } };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'ADD', 'overtime');
    return fail(error, 'overtime.add');
  }
}
