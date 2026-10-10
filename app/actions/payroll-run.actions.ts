'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as service from '@/lib/services/payroll-run.service';
import * as payroll from '@/lib/services/payroll.service';
import { RunScopeError } from '@/lib/services/payroll-control.service';
import { UserFacingError, toActionError, type ActionFailure } from '@/lib/errors/action-error';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import type { AddSlipHeadPayload, PayrollSlipOverridePayload } from '@/lib/types/payroll';
import type { PreflightResult, SlipDetail } from '@/lib/types/payroll-run';

// Security plan S55 (4.8a): every payroll run action checks the payroll
// permissions on the server; the preparer never approves a run
// (maker-checker, administrators included); nobody edits, recalculates,
// deletes or acknowledges their own payslip (S21, audited DENIED_SELF);
// every change is audited (ids and counts, not salaries); messages go
// through toActionError. S58: a run is read or acted on only by someone whose
// scope covers it whole (`guardRun` / `guardSlip`, audited DENIED_SCOPE);
// these are the only payroll run endpoints (the pre-workspace ones are gone).

type Ok<T = undefined> = { success: true; data?: T };
type Fail = ActionFailure & { validationErrors?: Record<string, string> };

const MODULE = 'PAYROLL_GENERATE';
const DECISIONS = ['approve', 'final_approve', 'reject'] as const;

function refresh() {
  revalidatePath('/payroll');
  revalidatePath('/dashboard');
}

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.RunValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** The signed-in user's scope and payroll permissions, for the service. */
async function ctxFor(action: 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'LOCK' | 'EXPORT', module: 'PAYROLL_GENERATE' | 'PAYROLL_REVIEW' = MODULE): Promise<service.RunCtx> {
  const scope = await checkPermissionWithScope(action, module);
  const [edit, approve, lock, del, exp, add] = await Promise.all([
    hasPermission('EDIT', 'PAYROLL_GENERATE'),
    hasPermission('APPROVE', 'PAYROLL_REVIEW'),
    hasPermission('LOCK', 'PAYROLL_REVIEW'),
    hasPermission('DELETE', 'PAYROLL_GENERATE'),
    hasPermission('EXPORT', 'PAYROLL_GENERATE'),
    hasPermission('ADD', 'PAYROLL_GENERATE'),
  ]);
  return { scope, userId: scope.userId, canApprove: approve, permissions: { generate: add, edit, approve, lock, delete: del, export: exp, settings: scope.scopeType === 'GLOBAL' && !scope.isImpersonation && approve } };
}

async function auditSelf(error: unknown, scope: ScopeFilter | null, action: 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE' | 'LOCK' | 'EXPORT', recordId: string) {
  if (!scope) return;
  if (error instanceof service.OwnPayslipError) await recordAuditLog({ userId: scope.userId, action, module: MODULE, recordId, result: DENIED_SELF });
  if (error instanceof RunScopeError) await recordAuditLog({ userId: scope.userId, action, module: MODULE, recordId, result: 'DENIED_SCOPE' });
}

/** S58: the run must be one the user's scope covers whole (refusals audited DENIED_SCOPE). */
async function guarded(ctx: service.RunCtx, action: 'VIEW' | 'EDIT' | 'DELETE' | 'APPROVE' | 'LOCK' | 'EXPORT', runId: string) {
  try {
    return await service.guardRun(runId, ctx);
  } catch (error: unknown) {
    await auditSelf(error, ctx.scope, action, runId);
    throw error;
  }
}

/** S58: a payslip's run, the same way. */
async function guardedSlip(ctx: service.RunCtx, action: 'VIEW' | 'EDIT' | 'DELETE', slipId: string) {
  const slip = await service.slipRun(slipId);
  await guarded(ctx, action, slip.payrollRunId);
  return slip;
}

/** The bank transfer file of a locked run (EXPORT; a run the scope covers whole). */
export async function bankFileAction(runId: string): Promise<Ok<string> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('EXPORT');
    await guarded(ctx, 'EXPORT', String(runId));
    const file = await service.bankFile(String(runId), ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EXPORT', module: MODULE, recordId: file.run.id, result: 'SUCCESS', newValues: { file: 'bank transfer', rows: file.rows } });
    return { success: true, data: file.csv };
  } catch (error: unknown) {
    return fail(error, 'payroll.bankFile');
  }
}

/** Pre-flight for a run that is not generated yet (the New run window's Check). */
export async function checkNewRunAction(input: unknown): Promise<Ok<PreflightResult> | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('ADD', MODULE);
    try {
      return { success: true, data: await service.checkNewRun(input, scope) };
    } catch (error: unknown) {
      await auditSelf(error, scope, 'ADD', 'new run');
      throw error;
    }
  } catch (error: unknown) {
    return fail(error, 'payroll.check');
  }
}

/** Generates a run (pre-flight must pass); the variance review is worked out at once. */
export async function generateRunAction(input: unknown): Promise<Ok<{ runId: string }> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('ADD');
    const { run } = await service.generate(input, ctx).catch(async (error: unknown) => {
      await auditSelf(error, ctx.scope, 'ADD', 'new run');
      throw error;
    });
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: MODULE, recordId: run.id, result: 'SUCCESS', newValues: { period: `${run.payPeriodYear}-${run.payPeriodMonth}`, employees: run.employeeCount, branches: run.branchIds.length } });
    refresh();
    return { success: true, data: { runId: run.id } };
  } catch (error: unknown) {
    return fail(error, 'payroll.generate');
  }
}

/** Pre-flight for an existing run (the Pre-flight step's Check again). */
export async function checkRunAction(runId: string): Promise<Ok<PreflightResult> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('VIEW');
    await guarded(ctx, 'VIEW', String(runId));
    return { success: true, data: await service.checkRun(String(runId)) };
  } catch (error: unknown) {
    return fail(error, 'payroll.check');
  }
}

/** Works the variance out again (after edits). */
export async function refreshVarianceAction(runId: string): Promise<Ok<{ open: number }> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('EDIT');
    await guarded(ctx, 'EDIT', String(runId));
    const open = await service.varianceOpenCount(String(runId));
    refresh();
    return { success: true, data: { open } };
  } catch (error: unknown) {
    return fail(error, 'payroll.variance');
  }
}

/** Submits a draft for approval. */
export async function submitRunAction(runId: string, note?: string): Promise<Ok<{ status: string }> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('EDIT');
    await guarded(ctx, 'EDIT', String(runId));
    const r = await service.submit(String(runId), note, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: MODULE, recordId: String(runId), result: 'SUCCESS', newValues: { submitted: true } });
    refresh();
    return { success: true, data: r };
  } catch (error: unknown) {
    return fail(error, 'payroll.submit');
  }
}

/** Approve, Final approve or reject a submitted run (the server decides who may). */
export async function decideRunAction(runId: string, decision: (typeof DECISIONS)[number], note?: string): Promise<Ok<{ status: string }> | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const ctx = await ctxFor('VIEW', 'PAYROLL_REVIEW');
    await guarded(ctx, 'APPROVE', String(runId));
    const r = await service.decide(String(runId), decision, note, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'PAYROLL_REVIEW', recordId: String(runId), result: 'SUCCESS', newValues: { decision, status: r.status } });
    refresh();
    return { success: true, data: r };
  } catch (error: unknown) {
    return fail(error, 'payroll.decide');
  }
}

/** Locks an approved run: payslips sealed, attendance sealed, loans amortised. */
export async function lockRunAction(runId: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('LOCK', 'PAYROLL_REVIEW');
    await guarded(ctx, 'LOCK', String(runId));
    const run = await service.lock(String(runId), ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'LOCK', module: 'PAYROLL_REVIEW', recordId: run.id, result: 'SUCCESS', newValues: { locked: true, employees: run.employeeCount } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'payroll.lock');
  }
}

/** Discards a run that is not locked. */
export async function discardRunAction(runId: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('DELETE');
    await guarded(ctx, 'DELETE', String(runId));
    await service.discard(String(runId), ctx);
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'payroll.discard');
  }
}

/** One payslip with its heads (the detail pane). */
export async function slipDetailAction(slipId: string): Promise<Ok<SlipDetail> | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('VIEW');
    await guardedSlip(ctx, 'VIEW', String(slipId));
    return { success: true, data: await service.slipDetail(String(slipId)) };
  } catch (error: unknown) {
    return fail(error, 'payroll.slip');
  }
}

/** Changes a figure or a head on a payslip (draft runs; never your own, S21). */
export async function overrideSlipAction(payload: PayrollSlipOverridePayload): Promise<Ok<SlipDetail> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    const ctx = await ctxFor('EDIT');
    scope = ctx.scope;
    const slip = await service.guardSlip(String(payload?.slipId), ctx);
    // The overtime working is attendance's (never typed: the browser's payload cannot carry it).
    await payroll.overridePayslipAllowanceDeduction({ ...payload, slipId: slip.id, otDetail: undefined }, ctx.userId);
    refresh();
    return { success: true, data: await service.slipDetail(slip.id) };
  } catch (error: unknown) {
    await auditSelf(error, scope, 'EDIT', String(payload?.slipId));
    return fail(error, 'payroll.override');
  }
}

/** Adds a pay head to a payslip (draft runs; never your own). */
export async function addSlipHeadAction(payload: AddSlipHeadPayload): Promise<Ok<SlipDetail> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    const ctx = await ctxFor('EDIT');
    scope = ctx.scope;
    const slip = await service.guardSlip(String(payload?.slipId), ctx);
    await payroll.addPayHeadToPayslip({ ...payload, slipId: slip.id }, ctx.userId);
    refresh();
    return { success: true, data: await service.slipDetail(slip.id) };
  } catch (error: unknown) {
    await auditSelf(error, scope, 'EDIT', String(payload?.slipId));
    return fail(error, 'payroll.addHead');
  }
}

/** Recalculates a payslip from master data (draft runs; never your own). */
export async function recalculateSlipAction(slipId: string): Promise<Ok<SlipDetail> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    const ctx = await ctxFor('EDIT');
    scope = ctx.scope;
    const slip = await service.guardSlip(String(slipId), ctx);
    await payroll.recalculateEmployeePayslip(slip.id, ctx.userId);
    refresh();
    return { success: true, data: await service.slipDetail(slip.id) };
  } catch (error: unknown) {
    await auditSelf(error, scope, 'EDIT', String(slipId));
    return fail(error, 'payroll.recalculate');
  }
}

/** Removes an employee from a draft run (never your own). */
export async function removeSlipAction(slipId: string): Promise<Ok<{ remainingCount: number }> | Fail> {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    const ctx = await ctxFor('DELETE');
    scope = ctx.scope;
    const slip = await service.guardSlip(String(slipId), ctx);
    const r = await payroll.deleteEmployeePayslip(slip.id, ctx.userId);
    refresh();
    return { success: true, data: r };
  } catch (error: unknown) {
    await auditSelf(error, scope, 'DELETE', String(slipId));
    return fail(error, 'payroll.removeSlip');
  }
}

/** Re-reads attendance for every payslip of a draft run. */
export async function syncRunAttendanceAction(runId: string): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('EDIT');
    await guarded(ctx, 'EDIT', String(runId));
    await payroll.syncPayrollRunAttendance(String(runId), ctx.userId);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: MODULE, recordId: String(runId), result: 'SUCCESS', newValues: { attendanceSynced: true } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'payroll.sync');
  }
}

/** Approval policy for pay runs and the variance threshold: a company administrator's control. */
export async function savePayrollRunSettingsAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('APPROVE', 'PAYROLL_REVIEW');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change payroll approval settings.');
    if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
    const saved = await service.saveSettings(input);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'PAYROLL_REVIEW', recordId: 'approvals.payrollRun', result: 'SUCCESS', newValues: { policy: saved.policy } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'payroll.settings');
  }
}
