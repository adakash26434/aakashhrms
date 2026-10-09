'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as trainingService from '@/lib/services/training.service';

// Training (G7): every action checks TRAINING inside the tenant context —
// VIEW lists / reads, ADD creates programmes and nominates, EDIT changes a
// programme, moves its status and marks participants. S35 own-record refusals
// are audited DENIED_SELF in the service.

type Need = 'VIEW' | 'ADD' | 'EDIT';

async function trainingCtx(action: Need): Promise<trainingService.TrainingCtx> {
  const scope = await checkPermissionWithScope(action, 'TRAINING');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

const revalidate = () => revalidatePath('/workforce/training');

const validationFailure = (error: unknown) =>
  error instanceof trainingService.TrainingValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getTrainingPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('VIEW');
    const [add, manage] = await Promise.all([hasPermission('ADD', 'TRAINING'), hasPermission('EDIT', 'TRAINING')]);
    return { success: true as const, data: await trainingService.trainingPage(ctx, { add, manage }) };
  } catch (error: unknown) {
    return toActionError(error, 'training.list');
  }
}

export async function getProgramAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('VIEW');
    const data = await trainingService.getProgram(typeof id === 'string' ? id : '', ctx);
    if (!data) return { success: false as const, error: 'Not found: this programme no longer exists.' };
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'training.get');
  }
}

export async function createProgramAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('ADD');
    const row = await trainingService.saveProgram(null, form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'TRAINING', recordId: row.id, result: 'SUCCESS', newValues: { kind: row.kind, hours: row.hours, bondMonths: row.bondMonths } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'training.create');
  }
}

export async function updateProgramAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('EDIT');
    const row = await trainingService.saveProgram(typeof id === 'string' ? id : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TRAINING', recordId: row.id, result: 'SUCCESS', newValues: { kind: row.kind, hours: row.hours, bondMonths: row.bondMonths } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'training.update');
  }
}

export async function moveProgramAction(id: string, to: string) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('EDIT');
    const detail = await trainingService.moveProgram(typeof id === 'string' ? id : '', typeof to === 'string' ? to : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TRAINING', recordId: detail.id, result: 'SUCCESS', newValues: { status: detail.status } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'training.move');
  }
}

export async function nominateAction(programId: string, employeeIds: string[]) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('ADD');
    const { detail, added } = await trainingService.nominate(typeof programId === 'string' ? programId : '', employeeIds, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'TRAINING', recordId: detail.id, result: 'SUCCESS', newValues: { nominated: added } });
    revalidate();
    return { success: true as const, data: { detail, added } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'training.nominate');
  }
}

export async function markParticipantAction(participantId: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await trainingCtx('EDIT');
    const detail = await trainingService.markParticipant(typeof participantId === 'string' ? participantId : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TRAINING', recordId: participantId, result: 'SUCCESS', newValues: { marked: true } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'training.mark');
  }
}
