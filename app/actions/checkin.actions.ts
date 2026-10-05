'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { getClientIp } from '@/lib/auth/client-ip';
import { createRateLimiter } from '@/lib/auth/rate-limiter';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import { recordAuditLog } from '@/lib/services/audit.service';
import { getSessionEmployeeId } from '@/lib/services/self-service.service';
import * as checkinService from '@/lib/services/checkin.service';
import { AttendanceValidationError } from '@/lib/services/attendance-errors';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { ClockStatus } from '@/lib/types/attendance';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

// Security plan S23 (4.5c web clock-in): the employee is always the
// signed-in user (from the session, never from the request), the time is
// the server's, the IP is the proxy-trusted one (S5), and the distance is
// worked out on the server. Clocking is rate limited per user; platform
// support never clocks in for anyone. Outside the allowed place the punch
// waits for someone else's approval (S21). Settings are a company-wide
// control and audited.

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, string> };
type Ok<T = undefined> = T extends undefined ? { success: true } : { success: true; data: T };

/** Ten clock attempts a minute per user, then a two-minute pause. */
const clockLimiter = createRateLimiter({ maxAttempts: 10, windowMs: 60_000, lockoutMs: 120_000 });

function fail(error: unknown, context: string): Fail {
  if (error instanceof AttendanceValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** The signed-in employee (never platform support acting as a company user). */
async function me(): Promise<{ employeeId: string; userId: string }> {
  if (await getImpersonationSession()) throw new UserFacingError('Platform support cannot clock in for anyone.');
  try {
    return await getSessionEmployeeId();
  } catch {
    throw new UserFacingError('Your account is not linked to an employee record, so you cannot clock in. Contact HR.');
  }
}

/** Today for the clock card. */
export async function clockStatusAction(): Promise<Ok<ClockStatus> | Fail> {
  await ensureTenantContext();
  try {
    const { employeeId } = await me();
    return { success: true, data: await checkinService.clockStatus(employeeId) };
  } catch (error: unknown) {
    return fail(error, 'checkin.status');
  }
}

/** Clock in or out now (the server decides which, and where it counts). */
export async function clockAction(input: unknown): Promise<Ok<checkinService.ClockResult> | Fail> {
  await ensureTenantContext();
  try {
    const { employeeId, userId } = await me();
    const key = `clock:${userId}`;
    const limit = clockLimiter.check(key);
    if (!limit.allowed) throw new UserFacingError('Too many tries. Wait a couple of minutes and try again.');
    clockLimiter.recordFailure(key);
    const ip = getClientIp(await headers());
    const result = await checkinService.clock(employeeId, input, { ip, userId });
    if (result.outcome === 'remote_sent') {
      await recordAuditLog({ userId, action: 'ADD', module: 'ATTENDANCE', recordId: employeeId, result: 'SUCCESS', newValues: { remoteClock: result.kind } });
    }
    if (result.outcome !== 'remote_needed') {
      revalidatePath('/self-service');
      revalidatePath('/self-service/my-attendance');
      revalidatePath('/timeAndLeave/attendance');
    }
    return { success: true, data: result };
  } catch (error: unknown) {
    return fail(error, 'checkin.clock');
  }
}

/** Company-wide control: Attendance → Edit with company scope, never platform support. */
async function companyControl(): Promise<ScopeFilter> {
  const scope = await checkPermissionWithScope('EDIT', 'ATTENDANCE');
  if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide role can change web clock-in.');
  if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
  return scope;
}

/** A branch's web clock-in rule, networks, office point and radius. */
export async function saveBranchCheckinAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await checkinService.saveBranch(input);
    const branchId = (input as { branchId?: unknown })?.branchId;
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: `branch-${typeof branchId === 'string' ? branchId : ''}`, result: 'SUCCESS', newValues: { checkinRule: result.rule } });
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'checkin.branch');
  }
}

/** Allows someone to clock in from anywhere (no approval). */
export async function addCheckinExceptionAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await checkinService.addException(input, { userId: scope.userId, myEmployeeId: scope.employeeId });
    await recordAuditLog({ userId: scope.userId, action: 'ADD', module: 'ATTENDANCE', recordId: result.employeeId, result: 'SUCCESS', newValues: { clockInAnywhere: true } });
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'checkin.exception');
  }
}

export async function removeCheckinExceptionAction(id: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await companyControl();
    const result = await checkinService.removeException(String(id));
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: result.employeeId, result: 'SUCCESS', newValues: { clockInAnywhere: false } });
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'checkin.exception');
  }
}
