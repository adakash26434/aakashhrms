'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, checkPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as controls from '@/lib/services/payroll-control.service';

// Payroll controls (4.8 / F1–F3): every action resolves the tenant and checks
// the module permission first. Variance review reads need PAYROLL_REVIEW view;
// acknowledging needs Approve; publish / hold / release need Lock; the settings
// sit under SYSTEM_CONTROL. Pre-flight is the pay run workspace's (payroll-run.actions).
// S58: every run and payslip action also needs a scope that covers the run whole
// (refusals audited DENIED_SCOPE).

async function ctxFor(action: 'VIEW' | 'APPROVE' | 'LOCK') {
  const scope = await checkPermissionWithScope(action, 'PAYROLL_REVIEW');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

type Ctx = Awaited<ReturnType<typeof ctxFor>>;

/** S58: the run (or the payslip's run) must be covered whole by the user's scope. */
async function inScope(ctx: Ctx, target: { runId: string } | { slipId: string }, action: 'VIEW' | 'APPROVE' | 'LOCK') {
  try {
    if ('runId' in target) await controls.assertRunInScope(target.runId, ctx.scope);
    else await controls.assertSlipInScope(target.slipId, ctx.scope);
  } catch (error: unknown) {
    if (error instanceof controls.RunScopeError) await recordAuditLog({ userId: ctx.userId, action, module: 'PAYROLL_REVIEW', recordId: 'runId' in target ? target.runId : target.slipId, result: 'DENIED_SCOPE' });
    throw error;
  }
}

const idOf = (v: unknown) => (typeof v === 'string' ? v : '');

const refresh = () => {
  revalidatePath('/payroll');
  revalidatePath('/self-service/my-payslips');
};

export async function getVarianceReviewAction(runId: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('VIEW');
    await inScope(ctx, { runId: idOf(runId) }, 'VIEW');
    const [review, held] = await Promise.all([controls.varianceReview(idOf(runId)), controls.heldPayslips(idOf(runId))]);
    return { success: true as const, data: { review, held } };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.variance');
  }
}

export async function acknowledgeFlagsAction(runId: string, keys: string[], note: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('APPROVE');
    await inScope(ctx, { runId: idOf(runId) }, 'APPROVE');
    const review = await controls.acknowledgeFlags(idOf(runId), keys, note, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'PAYROLL_REVIEW', recordId: runId, result: 'SUCCESS', newValues: { acknowledgedFlags: Array.isArray(keys) ? keys.length : 0 } });
    refresh();
    return { success: true as const, data: review };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.acknowledge');
  }
}

export async function publishRunAction(runId: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('LOCK');
    await inScope(ctx, { runId: idOf(runId) }, 'LOCK');
    const result = await controls.publishRun(idOf(runId), ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'LOCK', module: 'PAYROLL_REVIEW', recordId: runId, result: 'SUCCESS', newValues: { published: true } });
    refresh();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.publish');
  }
}

export async function holdSlipAction(slipId: string, reason: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('LOCK');
    await inScope(ctx, { slipId: idOf(slipId) }, 'LOCK');
    await controls.holdSlip(idOf(slipId), reason, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'LOCK', module: 'PAYROLL_REVIEW', recordId: slipId, result: 'SUCCESS', newValues: { held: true } });
    refresh();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.hold');
  }
}

export async function releaseSlipAction(slipId: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('LOCK');
    await inScope(ctx, { slipId: idOf(slipId) }, 'LOCK');
    await controls.releaseSlip(idOf(slipId));
    await recordAuditLog({ userId: ctx.userId, action: 'LOCK', module: 'PAYROLL_REVIEW', recordId: slipId, result: 'SUCCESS', newValues: { held: false } });
    refresh();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.release');
  }
}

export async function getPayrollControlSettingsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'SYSTEM_CONTROL');
    return { success: true as const, data: await controls.readSettings() };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.settings');
  }
}

export async function savePayrollControlSettingsAction(form: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'SYSTEM_CONTROL');
    const data = await controls.saveSettings(form);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'SYSTEM_CONTROL', recordId: null, result: 'SUCCESS', newValues: { payrollControls: data } });
    refresh();
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.saveSettings');
  }
}
