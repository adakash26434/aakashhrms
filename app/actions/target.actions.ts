'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as targetService from '@/lib/services/target.service';

// Targets (G15), office side: every action checks TARGETS inside the tenant
// context — VIEW lists, ADD sets targets, EDIT changes or removes a target
// nobody has reported on, APPROVE closes or returns what supervisors forwarded.
// S42 own-record refusals are audited DENIED_SELF in the service.

type Need = 'VIEW' | 'ADD' | 'EDIT' | 'APPROVE';

async function targetCtx(action: Need): Promise<targetService.TargetCtx> {
  const scope = await checkPermissionWithScope(action, 'TARGETS');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => revalidatePath('/workforce/targets');

const validationFailure = (error: unknown) =>
  error instanceof targetService.TargetValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getTargetsPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await targetCtx('VIEW');
    const [add, manage, decide] = await Promise.all([hasPermission('ADD', 'TARGETS'), hasPermission('EDIT', 'TARGETS'), hasPermission('APPROVE', 'TARGETS')]);
    return { success: true as const, data: await targetService.targetsPage(ctx, { add, manage, decide }) };
  } catch (error: unknown) {
    return toActionError(error, 'targets.list');
  }
}

export async function createTargetsAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await targetCtx('ADD');
    const result = await targetService.createTargets(form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'TARGETS', recordId: null, result: 'SUCCESS', newValues: { created: result.created, skipped: result.skipped } });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.create');
  }
}

export async function updateTargetAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await targetCtx('EDIT');
    const row = await targetService.updateTarget(typeof id === 'string' ? id : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TARGETS', recordId: row.id, result: 'SUCCESS', newValues: { target: row.targetValue, weight: row.weight } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.update');
  }
}

export async function deleteTargetAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await targetCtx('EDIT');
    await targetService.deleteTarget(typeof id === 'string' ? id : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'DELETE', module: 'TARGETS', recordId: id, result: 'SUCCESS' });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'targets.delete');
  }
}

export async function decideTargetAction(id: string, decision: string, reason?: string) {
  await ensureTenantContext();
  try {
    const ctx = await targetCtx('APPROVE');
    const row = await targetService.hrDecide(typeof id === 'string' ? id : '', decision === 'close' ? 'close' : 'return', reason, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'TARGETS', recordId: row.id, result: 'SUCCESS', newValues: { status: row.status } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.decide');
  }
}
