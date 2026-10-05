'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as shiftService from '@/lib/services/shift.service';
import { AttendanceValidationError, OutOfScopeError, OwnAttendanceError } from '@/lib/services/attendance-errors';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import { nepalDateIso } from '@/lib/utils/nepal-time';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

// Security plan S22 (4.5b shifts): defining shifts and branch defaults is a
// company-wide control (Attendance → Edit with company scope, not platform
// support); assigning shifts and the roster need Attendance → Edit and only
// reach people in the user's scope; nobody changes their own shift (S21,
// audited DENIED_SELF); closed months don't change; everything is audited
// and errors are safe.

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, string> };
type Ok<T = undefined> = T extends undefined ? { success: true } : { success: true; data: T };

function refresh() {
  revalidatePath('/timeAndLeave/attendance');
  revalidatePath('/dashboard');
}

function fail(error: unknown, context: string): Fail {
  if (error instanceof AttendanceValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

async function auditRefusal(error: unknown, scope: ScopeFilter | null, recordId: string) {
  if (!scope) return;
  if (error instanceof OwnAttendanceError) await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId, result: DENIED_SELF });
  else if (error instanceof OutOfScopeError) await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId, result: 'DENIED_SCOPE' });
}

/** Company-wide shift control: Attendance → Edit with company scope, never platform support. */
async function companyControl(): Promise<ScopeFilter> {
  const scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
  if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide role can define shifts. You can assign existing shifts to your people.');
  if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
  return scope;
}

/** Adds or changes a shift (hours, week, seasons, day rules). */
export async function saveShiftAction(input: unknown): Promise<Ok<{ id: string; warnings: string[] }> | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await shiftService.saveShift(input, { userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: result.created ? 'ADD' : 'EDIT', module: 'ATTENDANCE', recordId: `shift-${result.id}`, result: 'SUCCESS', newValues: { shift: result.code, warnings: result.warnings.length } });
    refresh();
    return { success: true, data: { id: result.id, warnings: result.warnings } };
  } catch (error: unknown) {
    return fail(error, 'shift.save');
  }
}

/** Makes a shift the company default (everyone without their own or a branch shift). */
export async function makeDefaultShiftAction(shiftId: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await shiftService.makeDefault(String(shiftId), { userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: `shift-${shiftId}`, result: 'SUCCESS', newValues: { companyDefault: result.code } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'shift.default');
  }
}

/** Archives a shift that is no longer used, or brings it back. */
export async function setShiftActiveAction(shiftId: string, active: boolean): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await shiftService.setActive(String(shiftId), active === true, { userId: scope.userId, today: nepalDateIso() });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: `shift-${shiftId}`, result: 'SUCCESS', newValues: { shift: result.code, active: active === true } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'shift.archive');
  }
}

/** A branch's default shift (null: the company default). */
export async function setBranchShiftAction(branchId: string, shiftId: string | null): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    await shiftService.setBranchDefault(String(branchId), shiftId ? String(shiftId) : null);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: `branch-${branchId}`, result: 'SUCCESS', newValues: { defaultShift: shiftId ?? 'company default' } });
    refresh();
    revalidatePath('/workforce/organization');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'shift.branch');
  }
}

/** Gives people in scope a shift from a date (to a date, or ongoing). */
export async function assignShiftAction(input: unknown): Promise<Ok<{ count: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    const result = await shiftService.assignShift(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: 'shift-assign', result: 'SUCCESS', newValues: { people: result.count, shift: result.shiftCode, from: result.from, to: result.to ?? 'ongoing' } });
    refresh();
    return { success: true, data: { count: result.count } };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'shift-assign');
    return fail(error, 'shift.assign');
  }
}

/** Roster days: a shift, OFF, or back to the usual shift (one note for the change). */
export async function setRosterAction(input: unknown): Promise<Ok<{ count: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    const result = await shiftService.setRoster(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: 'roster', result: 'SUCCESS', newValues: { rosterDays: result.count } });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'roster');
    return fail(error, 'shift.roster');
  }
}

/** Fills the roster from a rotation for people in scope. */
export async function rotateRosterAction(input: unknown): Promise<Ok<{ people: number; days: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
    const result = await shiftService.rotateRoster(input, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: 'roster-rotation', result: 'SUCCESS', newValues: { people: result.people, days: result.days, from: result.from, to: result.to, steps: result.steps, everyDays: result.everyDays } });
    refresh();
    return { success: true, data: { people: result.people, days: result.days } };
  } catch (error: unknown) {
    await auditRefusal(error, scope, 'roster-rotation');
    return fail(error, 'shift.rotate');
  }
}
