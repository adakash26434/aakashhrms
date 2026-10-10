'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { getSessionEmployeeId } from '@/lib/services/self-service.service';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as targetService from '@/lib/services/target.service';

// Targets (G15), portal side: the employee reports, the supervisor verifies and
// forwards. The employee is always the session's (getSessionEmployeeId
// re-checks the account); an id from the browser is only ever a target, and the
// service refuses anything that is not the caller's own or their team's.

async function me(): Promise<targetService.PortalCtx> {
  const { employeeId, userId } = await getSessionEmployeeId();
  return { employeeId, userId };
}

const revalidate = () => {
  revalidatePath('/self-service/my-targets');
  revalidatePath('/self-service/team-targets');
  revalidatePath('/workforce/targets');
};

const validationFailure = (error: unknown) =>
  error instanceof targetService.TargetValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function saveMyAchievementAction(id: string, form: unknown, attachmentIds: string[]) {
  await ensureTenantContext();
  try {
    const ctx = await me();
    const row = await targetService.saveMyAchievement(typeof id === 'string' ? id : '', form, attachmentIds, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TARGETS', recordId: row.id, result: 'SUCCESS', newValues: { selfService: true, reported: true } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.saveMine');
  }
}

export async function submitMyTargetsAction(ids: string[]) {
  await ensureTenantContext();
  try {
    const ctx = await me();
    const result = await targetService.submitMyTargets(ids, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TARGETS', recordId: ctx.employeeId, result: 'SUCCESS', newValues: { selfService: true, submitted: result.submitted } });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.submitMine');
  }
}

export async function removeMyEvidenceAction(attachmentId: string) {
  await ensureTenantContext();
  try {
    const ctx = await me();
    await targetService.removeMyAttachment(typeof attachmentId === 'string' ? attachmentId : '', ctx);
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'targets.removeEvidence');
  }
}

export async function reviewTeamTargetAction(id: string, decision: string, verifiedValue?: unknown, note?: string) {
  await ensureTenantContext();
  try {
    const ctx = await me();
    const row = await targetService.supervisorDecide(
      typeof id === 'string' ? id : '',
      { decision: decision === 'forward' ? 'forward' : 'return', verifiedValue, note },
      ctx,
    );
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'TARGETS', recordId: row.id, result: 'SUCCESS', newValues: { selfService: true, status: row.status } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'targets.review');
  }
}
