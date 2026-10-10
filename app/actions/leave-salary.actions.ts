'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError, UserFacingError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/leave-salary.service';

// Leave salary (4.9): every action checks LEAVE_SALARY with the user's scope inside the tenant
// context — ADD prepares (and previews), EDIT changes a draft, DELETE removes a draft, APPROVE
// approves or cancels. Platform support never changes anything here. S21 (own record) and
// maker-checker refusals are audited DENIED_SELF in the service; audit lines carry days, amounts
// and statuses.

type Need = 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE';

async function ctx(need: Need): Promise<service.LeaveSalaryCtx> {
  const scope = await checkPermissionWithScope(need, 'LEAVE_SALARY');
  if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change leave salary.');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => revalidatePath('/payroll/leave-salary');

const failure = (error: unknown, context: string) =>
  error instanceof service.LeaveSalaryValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : toActionError(error, context);

const audited = (r: { employeeId: string; source: string; leaveDays: string; totalAmount: string; status: string; paymentPeriod: string }) => ({
  employeeId: r.employeeId,
  source: r.source,
  days: Number(r.leaveDays),
  amount: r.totalAmount,
  status: r.status,
  payMonth: r.paymentPeriod,
});

/** What a new encashment would pay, worked out while the window is filled (nothing is saved). */
export async function previewLeaveSalaryAction(form: unknown) {
  await ensureTenantContext();
  try {
    return { success: true as const, data: await service.previewEncashment(form, await ctx('ADD')) };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.preview');
  }
}

export async function prepareLeaveSalaryAction(form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    const row = await service.prepareEncashment(form, c);
    await recordAuditLog({ userId: c.userId, action: 'ADD', module: 'LEAVE_SALARY', recordId: row.id, result: 'SUCCESS', newValues: audited(row) });
    revalidate();
    return { success: true as const, data: { id: row.id, amount: row.totalAmount } };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.prepare');
  }
}

/** Drafts for days over the limit at a year's opening (several at once). */
export async function prepareDueLeaveSalaryAction(input: { lineIds: string[]; payMonth: string; note?: string }) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    const result = await service.prepareDue(input, c);
    await recordAuditLog({ userId: c.userId, action: 'ADD', module: 'LEAVE_SALARY', result: 'SUCCESS', newValues: { source: 'year_end', prepared: result.prepared, skipped: result.skipped.length } });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.prepareDue');
  }
}

export async function updateLeaveSalaryAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('EDIT');
    const row = await service.updateDraft(typeof id === 'string' ? id : '', form, c);
    await recordAuditLog({ userId: c.userId, action: 'EDIT', module: 'LEAVE_SALARY', recordId: row.id, result: 'SUCCESS', newValues: audited(row) });
    revalidate();
    return { success: true as const, data: { id: row.id, amount: row.totalAmount } };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.update');
  }
}

export async function deleteLeaveSalaryAction(id: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('DELETE');
    const row = await service.deleteDraft(typeof id === 'string' ? id : '', c);
    await recordAuditLog({ userId: c.userId, action: 'DELETE', module: 'LEAVE_SALARY', recordId: row.id, result: 'SUCCESS', oldValues: audited(row) });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.delete');
  }
}

export async function approveLeaveSalaryAction(id: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('APPROVE');
    const row = await service.approveRecord(typeof id === 'string' ? id : '', c);
    await recordAuditLog({ userId: c.userId, action: 'APPROVE', module: 'LEAVE_SALARY', recordId: row.id, result: 'SUCCESS', newValues: audited(row) });
    revalidate();
    return { success: true as const, data: { id: row.id, payMonth: row.paymentPeriod } };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.approve');
  }
}

export async function cancelLeaveSalaryAction(id: string, reason: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('APPROVE');
    const row = await service.cancelRecord(typeof id === 'string' ? id : '', reason, c);
    await recordAuditLog({ userId: c.userId, action: 'APPROVE', module: 'LEAVE_SALARY', recordId: row.id, result: 'SUCCESS', newValues: { ...audited(row), cancelled: true } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return failure(error, 'leaveSalary.cancel');
  }
}
