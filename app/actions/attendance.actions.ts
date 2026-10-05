'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as service from '@/lib/services/attendance.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

// Security plan S22 (4.5): every attendance action checks the ATTENDANCE
// permission with the user's scope (branch / department), never lets anyone
// change or approve their own attendance (S21, audited DENIED_SELF), audits
// what changed (counts and ids, not salaries), and returns safe messages.

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, string> };
type Ok<T = undefined> = T extends undefined ? { success: true } : { success: true; data: T };

const DECISIONS = ['approve', 'final_approve', 'reject', 'withdraw'] as const;
const MAX_BULK = 200;

function refresh() {
  revalidatePath('/timeAndLeave/attendance');
  revalidatePath('/dashboard');
}

/** Refusals worth auditing: own attendance (S21) and people outside the scope. */
async function auditRefusal(error: unknown, scope: ScopeFilter | null, action: 'ADD' | 'EDIT' | 'APPROVE' | 'LOCK', recordId: string) {
  if (!scope) return;
  if (error instanceof service.OwnAttendanceError) {
    await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId, result: DENIED_SELF });
  } else if (error instanceof service.OutOfScopeError) {
    await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId, result: 'DENIED_SCOPE' });
  }
}

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.AttendanceValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** Sets or clears HR overrides on register days (one reason for the change). */
export async function setAttendanceOverridesAction(input: unknown): Promise<Ok<{ count: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    const result = await service.setOverrides(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: 'register', result: 'SUCCESS', newValues: { overrides: result.count } });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'EDIT', 'register');
    return fail(error, 'attendance.override');
  }
}

/** Adds an HR check-in / check-out for a day (with a note). */
export async function addAttendancePunchesAction(input: unknown): Promise<Ok<{ added: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('ADD', 'ATTENDANCE');
    const result = await service.addManualPunches(input, { scope, userId: scope.userId });
    const employeeId = (input as { employeeId?: unknown })?.employeeId;
    await recordAuditLog({ userId: scope.userId, action: 'ADD', module: 'ATTENDANCE', recordId: typeof employeeId === 'string' ? employeeId : 'punch', result: 'SUCCESS', newValues: { punches: result.added, source: 'manual' } });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'ADD', 'punch');
    return fail(error, 'attendance.punch');
  }
}

/** Voids a punch (it stays in the log with who and why). */
export async function voidAttendancePunchAction(punchId: string, reason: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    const result = await service.voidPunch(String(punchId), reason, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: String(punchId), result: 'SUCCESS', newValues: { voided: true, employee: result.employeeId } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'EDIT', String(punchId));
    return fail(error, 'attendance.void');
  }
}

/** Raises an adjustment (regularization) for an employee-day; it waits for the supervisor or an approver. */
export async function createAttendanceAdjustmentAction(input: unknown): Promise<Ok<{ id: string }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('ADD', 'ATTENDANCE');
    const result = await service.createAdjustment(input, { scope, userId: scope.userId, source: 'hr' });
    await recordAuditLog({ userId: scope.userId, action: 'ADD', module: 'ATTENDANCE', recordId: result.id, result: 'SUCCESS', newValues: { adjustment: result.id, employee: result.employeeId } });
    refresh();
    return { success: true, data: { id: result.id } };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'ADD', 'adjustment');
    return fail(error, 'attendance.adjustment');
  }
}

/**
 * Approve, Final approve, reject or withdraw adjustments (one or many).
 * Who may act is decided on the server: the employee's supervisor or
 * Attendance → Approve in scope; company administrators Final approve;
 * never your own attendance. Each is checked and audited on its own.
 */
export async function decideAttendanceAdjustmentsAction(ids: string[], decision: (typeof DECISIONS)[number], note?: string): Promise<Ok<{ done: number; failed: { id: string; error: string }[] }> | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const list = Array.isArray(ids) ? [...new Set(ids.map(String))].slice(0, MAX_BULK) : [];
    if (!list.length) throw new UserFacingError('Choose at least one adjustment.');
    const scope = await checkPermissionWithScope('VIEW', 'ATTENDANCE');
    const canApprove = await hasPermission('APPROVE', 'ATTENDANCE');
    const action = decision === 'withdraw' ? 'EDIT' : 'APPROVE';
    let done = 0;
    const failed: { id: string; error: string }[] = [];
    for (const id of list) {
      try {
        const r = await service.decideAdjustment(id, decision, note, { scope, userId: scope.userId, canApprove });
        await recordAuditLog({ userId: scope.userId, action, module: 'ATTENDANCE', recordId: id, result: 'SUCCESS', newValues: { decision, status: r.status, employee: r.employeeId } });
        done++;
      } catch (error) {
        if (error instanceof service.OwnAttendanceError || error instanceof service.OutOfScopeError) await auditRefusal(error, scope, action, id);
        if (error instanceof UserFacingError) failed.push({ id, error: error.message });
        else if (error instanceof service.AttendanceValidationError) failed.push({ id, error: Object.values(error.errors)[0] ?? 'Not changed.' });
        else throw error;
      }
    }
    if (done) refresh();
    if (!done && failed.length === 1) return { success: false, error: failed[0].error };
    return { success: true, data: { done, failed } };
  } catch (error: unknown) {
    return fail(error, 'attendance.decide');
  }
}

/** Closes a month for branches (days and summaries stored and locked for payroll). */
export async function closeAttendanceMonthAction(input: unknown): Promise<Ok<{ branches: number; employees: number; homeLeaveDays: number; homeLeavePeople: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('LOCK', 'ATTENDANCE');
    const result = await service.closeMonth(input, { scope, userId: scope.userId });
    const r = (input ?? {}) as { year?: unknown; month?: unknown };
    await recordAuditLog({ userId: scope.userId, action: 'LOCK', module: 'ATTENDANCE', recordId: `month-${String(r.year)}-${String(r.month)}`, result: 'SUCCESS', newValues: { closed: true, ...result } });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'LOCK', 'month');
    return fail(error, 'attendance.close');
  }
}

/** Reopens a branch month (reason; refused once payroll for it is approved or locked). */
export async function reopenAttendanceMonthAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('LOCK', 'ATTENDANCE');
    const result = await service.reopenMonth(input, { scope, userId: scope.userId });
    const r = (input ?? {}) as { year?: unknown; month?: unknown };
    await recordAuditLog({ userId: scope.userId, action: 'LOCK', module: 'ATTENDANCE', recordId: `month-${String(r.year)}-${String(r.month)}`, result: 'SUCCESS', newValues: { reopened: true, branch: result.branchId } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'LOCK', 'month');
    return fail(error, 'attendance.reopen');
  }
}

/** Attendance rules (nothing-recorded rule, late rule; working hours are in shifts): a company administrator's control. */
export async function saveAttendanceRulesAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change the attendance rules.');
    if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
    const rules = await service.saveRules(input);
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'ATTENDANCE',
      recordId: 'attendance-rules',
      result: 'SUCCESS',
      newValues: { noRecord: rules.noRecord, lateRule: rules.lateRule.enabled, lateCount: rules.lateRule.count },
    });
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'attendance.rules');
  }
}
