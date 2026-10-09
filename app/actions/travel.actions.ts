'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as travelService from '@/lib/services/travel.service';

// TA-DA (G11): every action checks TRAVEL inside the tenant context — VIEW
// lists, ADD records / submits a claim, EDIT changes drafts and the rate card,
// APPROVE approves / rejects / returns, LOCK marks a claim settled (paid).
// S38 own-claim refusals are audited DENIED_SELF in the service.

type Need = 'VIEW' | 'ADD' | 'EDIT' | 'APPROVE' | 'LOCK';

async function travelCtx(action: Need): Promise<travelService.TravelCtx> {
  const scope = await checkPermissionWithScope(action, 'TRAVEL');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => revalidatePath('/payroll/travel');

const validationFailure = (error: unknown) =>
  error instanceof travelService.TravelValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getTravelPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await travelCtx('VIEW');
    const [add, manage, approve, settle] = await Promise.all([hasPermission('ADD', 'TRAVEL'), hasPermission('EDIT', 'TRAVEL'), hasPermission('APPROVE', 'TRAVEL'), hasPermission('LOCK', 'TRAVEL')]);
    return { success: true as const, data: await travelService.travelPage(ctx, { add, manage, approve, settle }) };
  } catch (error: unknown) {
    return toActionError(error, 'travel.list');
  }
}

export async function saveTravelRateAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await travelCtx('EDIT');
    const row = await travelService.saveRate(typeof id === 'string' ? id : null, form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: id ? 'EDIT' : 'ADD', module: 'TRAVEL', recordId: row.id, result: 'SUCCESS', newValues: { rate: row.name, dailyAllowance: row.dailyAllowance, lodgingPerNight: row.lodgingPerNight, kmRate: row.kmRate } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'travel.rate');
  }
}

export async function saveTravelClaimAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await travelCtx(id ? 'EDIT' : 'ADD');
    const row = await travelService.saveClaim(typeof id === 'string' ? id : null, form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: id ? 'EDIT' : 'ADD', module: 'TRAVEL', recordId: row.id, result: 'SUCCESS', newValues: { employeeId: row.employeeId, days: row.days, payable: row.payable } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'travel.save');
  }
}

const NEED: Record<string, Need> = { submitted: 'ADD', approved: 'APPROVE', rejected: 'APPROVE', draft: 'APPROVE', settled: 'LOCK' };

export async function moveTravelClaimAction(id: string, to: string, note: string) {
  await ensureTenantContext();
  try {
    const need = NEED[typeof to === 'string' ? to : ''];
    if (!need) return { success: false as const, error: 'Unknown step.' };
    const ctx = await travelCtx(need);
    const row = await travelService.moveClaim(typeof id === 'string' ? id : '', to, typeof note === 'string' ? note : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: need === 'ADD' ? 'EDIT' : need, module: 'TRAVEL', recordId: row.id, result: 'SUCCESS', newValues: { status: row.status, payable: row.payable } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'travel.move');
  }
}
