'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as exitService from '@/lib/services/exit.service';
import type { ExitFilter } from '@/lib/repositories/exit.repository';

// Exit workflow (G5): exits change the employee record, so everything sits
// under EMPLOYEES (VIEW lists, EDIT opens / clears / completes / cancels);
// the experience letter additionally needs HR_LETTERS ADD. S31 own-record
// refusals are audited DENIED_SELF in the service.

async function exitCtx(action: 'VIEW' | 'EDIT'): Promise<exitService.ExitCtx> {
  const scope = await checkPermissionWithScope(action, 'EMPLOYEES');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

function revalidate() {
  revalidatePath('/workforce/exit');
  revalidatePath('/workforce/employees');
}

const validationFailure = (error: unknown) =>
  error instanceof exitService.ExitValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getExitPageAction(filter: ExitFilter = {}) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('VIEW');
    const [manage, issueLetter] = await Promise.all([hasPermission('EDIT', 'EMPLOYEES'), hasPermission('ADD', 'HR_LETTERS')]);
    const data = await exitService.exitPage(ctx, { manage, issueLetter }, filter);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.list');
  }
}

export async function getExitCaseAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('VIEW');
    const data = await exitService.getExitCase(typeof id === 'string' ? id : '', ctx);
    if (!data) return { success: false as const, error: 'Not found: this exit case is not in your scope.' };
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.get');
  }
}

export async function openExitCaseAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('EDIT');
    const row = await exitService.openExitCase(form, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: row.employeeId,
      result: 'SUCCESS',
      newValues: { exitCase: row.kind, lastWorkingDay: row.lastWorkingDayBs, opened: true },
    });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'exit.open');
  }
}

export async function decideExitClearanceAction(id: string, unit: string, status: string, note: string) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('EDIT');
    const detail = await exitService.decideClearance(id, unit, status, typeof note === 'string' ? note : '', ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: detail.employeeId,
      result: 'SUCCESS',
      newValues: { exitClearance: unit, status },
    });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'exit.clearance');
  }
}

export async function completeExitCaseAction(id: string, options: { issueLetter?: boolean; letterLanguage?: string }) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('EDIT');
    const canIssue = await hasPermission('ADD', 'HR_LETTERS');
    const result = await exitService.completeExitCase(
      id,
      { issueLetter: canIssue && options?.issueLetter === true, letterLanguage: options?.letterLanguage === 'en' ? 'en' : 'np' },
      ctx,
    );
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: result.detail.employeeId,
      result: 'SUCCESS',
      newValues: { exitCompleted: result.detail.kind, lastWorkingDay: result.detail.lastWorkingDayBs, letterId: result.detail.letterId },
    });
    revalidate();
    const letterWarning = result.letterWarning ?? (options?.issueLetter === true && !canIssue ? 'Exit completed; you do not have permission to issue letters.' : null);
    return { success: true as const, data: { detail: result.detail, letterWarning } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'exit.complete');
  }
}

export async function cancelExitCaseAction(id: string, reason: string) {
  await ensureTenantContext();
  try {
    const ctx = await exitCtx('EDIT');
    const detail = await exitService.cancelExitCase(id, typeof reason === 'string' ? reason : '', ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: detail.employeeId,
      result: 'SUCCESS',
      newValues: { exitCancelled: true, cancelReason: detail.cancelReason },
    });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'exit.cancel');
  }
}
