'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as caseService from '@/lib/services/case.service';

// Disciplinary & grievance (G8): every action checks DISCIPLINE inside the
// tenant context — VIEW lists / reads, ADD opens, EDIT investigates / notes /
// closes, APPROVE records the decision. S34 own-record refusals are audited
// DENIED_SELF in the service. Audit lines carry ids and outcome codes only,
// never the case text.

type Need = 'VIEW' | 'ADD' | 'EDIT' | 'APPROVE';

async function caseCtx(action: Need): Promise<caseService.CaseCtx> {
  const scope = await checkPermissionWithScope(action, 'DISCIPLINE');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => revalidatePath('/workforce/discipline');

const validationFailure = (error: unknown) =>
  error instanceof caseService.CaseValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getCasePageAction() {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('VIEW');
    const [open, manage, decide] = await Promise.all([hasPermission('ADD', 'DISCIPLINE'), hasPermission('EDIT', 'DISCIPLINE'), hasPermission('APPROVE', 'DISCIPLINE')]);
    return { success: true as const, data: await caseService.casePage(ctx, { open, manage, decide }) };
  } catch (error: unknown) {
    return toActionError(error, 'case.list');
  }
}

export async function getCaseAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('VIEW');
    const data = await caseService.getCase(typeof id === 'string' ? id : '', ctx);
    if (!data) return { success: false as const, error: 'Not found: this case is not in your scope.' };
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'case.get');
  }
}

export async function openCaseAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('ADD');
    const row = await caseService.openCase(form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'DISCIPLINE', recordId: row.id, result: 'SUCCESS', newValues: { category: row.category, severity: row.severity } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'case.open');
  }
}

export async function investigateCaseAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('EDIT');
    const detail = await caseService.investigate(typeof id === 'string' ? id : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'DISCIPLINE', recordId: detail.id, result: 'SUCCESS', newValues: { status: detail.status } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'case.investigate');
  }
}

export async function decideCaseAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('APPROVE');
    const detail = await caseService.decide(typeof id === 'string' ? id : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'DISCIPLINE', recordId: detail.id, result: 'SUCCESS', newValues: { outcome: detail.outcome } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'case.decide');
  }
}

export async function closeCaseAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('EDIT');
    const detail = await caseService.closeCase(typeof id === 'string' ? id : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'DISCIPLINE', recordId: detail.id, result: 'SUCCESS', newValues: { status: 'closed' } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'case.close');
  }
}

export async function addCaseNoteAction(id: string, text: string) {
  await ensureTenantContext();
  try {
    const ctx = await caseCtx('EDIT');
    const detail = await caseService.addCaseNote(typeof id === 'string' ? id : '', typeof text === 'string' ? text : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'DISCIPLINE', recordId: detail.id, result: 'SUCCESS', newValues: { note: true } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'case.note');
  }
}
