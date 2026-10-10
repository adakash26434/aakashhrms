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

async function ctxFor(action: 'VIEW' | 'APPROVE' | 'LOCK') {
  const scope = await checkPermissionWithScope(action, 'PAYROLL_REVIEW');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId };
}

const refresh = () => {
  revalidatePath('/payroll');
  revalidatePath('/self-service/my-payslips');
};

export async function getVarianceReviewAction(runId: string) {
  await ensureTenantContext();
  try {
    await ctxFor('VIEW');
    const [review, held] = await Promise.all([controls.varianceReview(typeof runId === 'string' ? runId : ''), controls.heldPayslips(typeof runId === 'string' ? runId : '')]);
    return { success: true as const, data: { review, held } };
  } catch (error: unknown) {
    return toActionError(error, 'payroll.variance');
  }
}

export async function acknowledgeFlagsAction(runId: string, keys: string[], note: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('APPROVE');
    const review = await controls.acknowledgeFlags(typeof runId === 'string' ? runId : '', keys, note, ctx);
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
    const result = await controls.publishRun(typeof runId === 'string' ? runId : '', ctx);
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
    await controls.holdSlip(typeof slipId === 'string' ? slipId : '', reason, ctx);
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
    await controls.releaseSlip(typeof slipId === 'string' ? slipId : '');
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
