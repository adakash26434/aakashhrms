'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as evaluationService from '@/lib/services/evaluation.service';
import { normalizeForm, validateForm } from '@/lib/engines/evaluation.engine';
import * as repo from '@/lib/repositories/evaluation.repository';
import { DEFAULT_EVALUATION_TEMPLATE } from '@/lib/constants/evaluation-template';
import type { EvaluationFilter } from '@/lib/repositories/evaluation.repository';

// Performance evaluation (G1): VIEW lists, ADD opens cycles and starts
// evaluations, EDIT scores an assigned stage and changes the form, APPROVE
// also lets a user score for an absent rater (audited), LOCK closes a cycle.
// S28 own-record refusals are audited DENIED_SELF in the service.

async function evaluationCtx(action: 'VIEW' | 'ADD' | 'EDIT' | 'APPROVE' | 'LOCK'): Promise<evaluationService.EvaluationCtx> {
  const scope = await checkPermissionWithScope(action, 'PERFORMANCE');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

function revalidate() {
  revalidatePath('/workforce/evaluation');
}

const validationFailure = (error: unknown) =>
  error instanceof evaluationService.EvaluationValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getEvaluationsPageAction(filter: EvaluationFilter = {}) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('VIEW');
    const [add, edit, approve, lock] = await Promise.all([
      hasPermission('ADD', 'PERFORMANCE'),
      hasPermission('EDIT', 'PERFORMANCE'),
      hasPermission('APPROVE', 'PERFORMANCE'),
      hasPermission('LOCK', 'PERFORMANCE'),
    ]);
    const data = await evaluationService.evaluationsPage(ctx, { open: add, start: add, rate: edit, finalize: approve, close: lock, editForm: edit }, filter);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'evaluation.list');
  }
}

export async function getEvaluationAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('VIEW');
    const data = await evaluationService.getEvaluation(typeof id === 'string' ? id : '', ctx);
    if (!data) return { success: false as const, error: 'Not found: this evaluation is not in your scope.' };
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'evaluation.get');
  }
}

export async function openEvaluationCycleAction(form: { fiscalYearId?: string; label?: string; period?: string }) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('ADD');
    const cycle = await evaluationService.openCycle(form ?? {}, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'PERFORMANCE', recordId: cycle.id, result: 'SUCCESS', newValues: { cycle: cycle.label, period: cycle.period } });
    revalidate();
    return { success: true as const, data: { id: cycle.id, label: cycle.label } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'evaluation.open-cycle');
  }
}

export async function closeEvaluationCycleAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('LOCK');
    const cycle = await evaluationService.closeCycle(typeof id === 'string' ? id : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'LOCK', module: 'PERFORMANCE', recordId: cycle.id, result: 'SUCCESS', newValues: { cycle: cycle.label, closed: true } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'evaluation.close-cycle');
  }
}

export async function startEvaluationsAction(input: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('ADD');
    const result = await evaluationService.startEvaluations(input, ctx);
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'evaluation.start');
  }
}

export async function rateEvaluationStageAction(input: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('EDIT');
    const canActForRater = await hasPermission('APPROVE', 'PERFORMANCE');
    const data = await evaluationService.rateStage(input, ctx, canActForRater);
    revalidate();
    return { success: true as const, data };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'evaluation.rate');
  }
}

export async function saveEvaluationFormAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await evaluationCtx('EDIT');
    const normalized = normalizeForm(form);
    const errors = validateForm(normalized);
    if (errors.length) return { success: false as const, error: errors[0], validationErrors: { form: errors.join(' ') } };
    await evaluationService.ensureDefaultTemplate();
    const template = await repo.findTemplate(DEFAULT_EVALUATION_TEMPLATE.code);
    await repo.updateTemplateForm(template!.id, { name: template!.name, nameNp: template!.nameNp, form: normalized as unknown as Record<string, unknown> }, ctx.userId);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'PERFORMANCE', recordId: template!.id, result: 'SUCCESS', newValues: { template: true, criteria: normalized.sections.reduce((n, s) => n + s.criteria.length, 0) } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'evaluation.form-save');
  }
}
