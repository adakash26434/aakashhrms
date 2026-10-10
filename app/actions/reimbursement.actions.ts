'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/reimbursement.service';

// Reimbursements (4.8 / F16): every action checks REIMBURSEMENTS with the user's scope inside the
// tenant context — ADD records or submits a claim, EDIT changes drafts and the types, APPROVE
// approves / rejects / returns, LOCK marks an approved claim paid by hand. S21 own-claim refusals
// are audited DENIED_SELF in the service; audit lines carry amounts and statuses, never the bill text.

type Need = 'ADD' | 'EDIT' | 'APPROVE' | 'LOCK';

async function ctx(need: Need): Promise<service.ReimbursementCtx> {
  const scope = await checkPermissionWithScope(need, 'REIMBURSEMENTS');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => {
  revalidatePath('/payroll/reimbursements');
  revalidatePath('/self-service/my-reimbursements');
};

const failure = (error: unknown, context: string) =>
  error instanceof service.ReimbursementValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : toActionError(error, context);

export async function saveReimbursementTypeAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('EDIT');
    const row = await service.saveType(typeof id === 'string' && id ? id : null, form, c);
    await recordAuditLog({ userId: c.userId, action: id ? 'EDIT' : 'ADD', module: 'REIMBURSEMENTS', recordId: row.id, result: 'SUCCESS', newValues: { type: row.code, taxable: row.taxable, perClaimCap: row.perClaimCap, yearlyCap: row.yearlyCap, active: row.isActive } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return failure(error, 'reimbursement.type');
  }
}

/** Saves a draft; with `submit` the new claim is submitted at once. */
export async function saveReimbursementClaimAction(id: string | null, form: unknown, submit = false) {
  await ensureTenantContext();
  try {
    const c = await ctx(id ? 'EDIT' : 'ADD');
    const row = await service.saveClaim(typeof id === 'string' && id ? id : null, form, c, { submit: !id && submit === true });
    await recordAuditLog({ userId: c.userId, action: id ? 'EDIT' : 'ADD', module: 'REIMBURSEMENTS', recordId: row.id, result: 'SUCCESS', newValues: { employeeId: row.employeeId, type: row.typeCode, amount: row.amount, status: row.status } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return failure(error, 'reimbursement.save');
  }
}

const NEED: Record<string, Need> = { submitted: 'ADD', approved: 'APPROVE', rejected: 'APPROVE', draft: 'APPROVE', settled: 'LOCK' };

export async function moveReimbursementClaimAction(id: string, to: string, note: string) {
  await ensureTenantContext();
  try {
    const need = NEED[typeof to === 'string' ? to : ''];
    if (!need) return { success: false as const, error: 'Unknown step.' };
    const c = await ctx(need);
    const row = await service.moveClaim(typeof id === 'string' ? id : '', to, typeof note === 'string' ? note : '', c);
    await recordAuditLog({ userId: c.userId, action: need === 'ADD' ? 'EDIT' : need, module: 'REIMBURSEMENTS', recordId: row.id, result: 'SUCCESS', newValues: { status: row.status, amount: row.amount } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return failure(error, 'reimbursement.move');
  }
}
