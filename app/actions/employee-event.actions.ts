'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as eventService from '@/lib/services/employee-event.service';
import type { EventFilter } from '@/lib/repositories/employee-event.repository';

// Lifecycle events (G2): recording a promotion / transfer / confirmation is
// an EMPLOYEES change (EDIT), listing needs EMPLOYEES VIEW; the optional
// letter additionally needs HR_LETTERS ADD. Nobody records or cancels an
// event about their own record (S27, audited DENIED_SELF in the service).

async function eventCtx(action: 'VIEW' | 'EDIT'): Promise<eventService.EventCtx> {
  const scope = await checkPermissionWithScope(action, 'EMPLOYEES');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

function revalidate() {
  revalidatePath('/workforce/lifecycle');
  revalidatePath('/workforce/employees');
  revalidatePath('/workforce/letters');
}

const validationFailure = (error: unknown) =>
  error instanceof eventService.EventValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getEventsPageAction(filter: EventFilter = {}) {
  await ensureTenantContext();
  try {
    const ctx = await eventCtx('VIEW');
    const [add, issueLetter] = await Promise.all([hasPermission('EDIT', 'EMPLOYEES'), hasPermission('ADD', 'HR_LETTERS')]);
    const data = await eventService.eventsPage(ctx.scope, { add, cancel: add, issueLetter }, filter);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'employee-event.list');
  }
}

export async function createEmployeeEventAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await eventCtx('EDIT');
    // The letter ride-along needs its own permission; without it the event
    // still saves and the letter is left to someone who may issue letters.
    const canIssue = await hasPermission('ADD', 'HR_LETTERS');
    const raw = (form && typeof form === 'object' ? form : {}) as Record<string, unknown>;
    const result = await eventService.createEvent(canIssue ? raw : { ...raw, issueLetter: false }, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: result.event.employeeId,
      result: 'SUCCESS',
      newValues: { lifecycleEvent: result.event.kind, change: result.event.change, effective: result.event.effectiveDateBs, status: result.event.status, letterId: result.letterId },
    });
    revalidate();
    const letterWarning = result.letterWarning ?? (raw.issueLetter === true && !canIssue ? 'Event saved; you do not have permission to issue letters.' : null);
    return { success: true as const, data: { ...result, letterWarning } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'employee-event.create');
  }
}

export async function cancelEmployeeEventAction(id: string, reason: string) {
  await ensureTenantContext();
  try {
    const ctx = await eventCtx('EDIT');
    const event = await eventService.cancelScheduledEvent(id, typeof reason === 'string' ? reason : '', ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: event.employeeId,
      result: 'SUCCESS',
      newValues: { lifecycleEvent: event.kind, cancelled: true, cancelReason: event.cancelReason },
    });
    revalidate();
    return { success: true as const, data: event };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'employee-event.cancel');
  }
}
