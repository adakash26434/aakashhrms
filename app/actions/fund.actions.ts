'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as fundService from '@/lib/services/fund.service';

// Welfare funds (G9): VIEW watches balances, ADD posts openings / payouts /
// adjustments, EDIT manages fund types. Contributions post themselves (the
// fund-contributions job, BS day 1) — no action posts them from a browser.

async function fundCtx(action: 'VIEW' | 'ADD' | 'EDIT'): Promise<fundService.FundCtx> {
  const scope = await checkPermissionWithScope(action, 'WELFARE_FUNDS');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

function revalidate() {
  revalidatePath('/payroll/funds');
}

const validationFailure = (error: unknown) =>
  error instanceof fundService.FundValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getFundsPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await fundCtx('VIEW');
    const [post, manageTypes] = await Promise.all([hasPermission('ADD', 'WELFARE_FUNDS'), hasPermission('EDIT', 'WELFARE_FUNDS')]);
    const data = await fundService.fundsPage(ctx, { post, manageTypes });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'fund.list');
  }
}

export async function saveFundTypeAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await fundCtx('EDIT');
    const row = await fundService.saveFundType(id, form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: id ? 'EDIT' : 'ADD', module: 'WELFARE_FUNDS', recordId: row.id, result: 'SUCCESS', newValues: { fund: row.code, mode: row.contributionMode, employee: row.employeeValue, employer: row.employerValue, active: row.isActive } });
    revalidate();
    return { success: true as const, data: { id: row.id, name: row.name } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'fund.type-save');
  }
}

export async function getFundLinesAction(fundTypeId: string, employeeId: string) {
  await ensureTenantContext();
  try {
    const ctx = await fundCtx('VIEW');
    const data = await fundService.memberLines(typeof fundTypeId === 'string' ? fundTypeId : '', typeof employeeId === 'string' ? employeeId : '', ctx);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'fund.lines');
  }
}

export async function postFundEntryAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await fundCtx('ADD');
    const result = await fundService.postFundEntry(form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'WELFARE_FUNDS', recordId: result.ref, result: 'SUCCESS', newValues: { posting: result.ref, employee: result.employeeAmount, employer: result.employerAmount } });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'fund.post');
  }
}
