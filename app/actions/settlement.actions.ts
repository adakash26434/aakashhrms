'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as settlementService from '@/lib/services/settlement.service';

function revalidate() {
  revalidatePath('/workforce/exit');
}

// Full & final settlement (4.8 / F8). Preparing sits with whoever manages the exit
// (EMPLOYEES EDIT); approving and paying are payroll decisions (PAYROLL_REVIEW
// APPROVE / LOCK); the policy lives with company settings (SYSTEM_CONTROL EDIT).
// S31: the service refuses every step on one's own exit case (DENIED_SELF).

async function settlementCtx(action: 'VIEW' | 'EDIT' | 'APPROVE' | 'LOCK', module: 'EMPLOYEES' | 'PAYROLL_REVIEW' | 'SYSTEM_CONTROL' = 'EMPLOYEES'): Promise<settlementService.SettlementCtx> {
  const scope = await checkPermissionWithScope(action, module);
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const settlementAudit = (ctx: settlementService.SettlementCtx, caseId: string, step: string, extra: Record<string, unknown> = {}) =>
  recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: caseId, result: 'SUCCESS', newValues: { settlement: step, ...extra } });

export async function getSettlementAction(caseId: string) {
  await ensureTenantContext();
  try {
    const ctx = await settlementCtx('VIEW');
    const [prepare, approve, pay, policy] = await Promise.all([
      hasPermission('EDIT', 'EMPLOYEES'),
      hasPermission('APPROVE', 'PAYROLL_REVIEW'),
      hasPermission('LOCK', 'PAYROLL_REVIEW'),
      hasPermission('EDIT', 'SYSTEM_CONTROL'),
    ]);
    const data = await settlementService.getSettlement(typeof caseId === 'string' ? caseId : '', ctx, { prepare, approve, pay, policy });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.settlement.get');
  }
}

export async function prepareSettlementAction(caseId: string) {
  await ensureTenantContext();
  try {
    const ctx = await settlementCtx('EDIT');
    const data = await settlementService.prepareSettlement(typeof caseId === 'string' ? caseId : '', ctx);
    await settlementAudit(ctx, caseId, 'prepared', { net: data.net });
    revalidate();
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.settlement.prepare');
  }
}

export async function approveSettlementAction(caseId: string) {
  await ensureTenantContext();
  try {
    const ctx = await settlementCtx('APPROVE', 'PAYROLL_REVIEW');
    const data = await settlementService.approveSettlement(typeof caseId === 'string' ? caseId : '', ctx);
    await settlementAudit(ctx, caseId, 'approved', { net: data.net });
    revalidate();
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.settlement.approve');
  }
}

export async function markSettlementPaidAction(caseId: string, paymentRef: string) {
  await ensureTenantContext();
  try {
    const ctx = await settlementCtx('LOCK', 'PAYROLL_REVIEW');
    const data = await settlementService.markSettlementPaid(typeof caseId === 'string' ? caseId : '', paymentRef, ctx);
    await settlementAudit(ctx, caseId, 'paid', { net: data.net, paymentRef: data.paymentRef });
    revalidate();
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'exit.settlement.pay');
  }
}

export async function saveSettlementPolicyAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await settlementCtx('EDIT', 'SYSTEM_CONTROL');
    const data = await settlementService.savePolicy(form, ctx);
    return { success: true as const, data };
  } catch (error: unknown) {
    if (error instanceof settlementService.PolicyValidationError) return { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors };
    return toActionError(error, 'exit.settlement.policy');
  }
}
