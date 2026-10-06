'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import { auth } from '@/lib/auth';
import { resolvePlatformCompanyForTenant } from '@/lib/platform/company-resolver';
import { ExceptionValidationError } from '@/lib/platform/leave-exceptions';
import * as service from '@/lib/services/leave-policy.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { PolicyPreview } from '@/lib/types/leave-policy';

// Security plan S24 (4.6c): statutory leave changes only in the employees'
// favour (the server checks the Labour Act minimum, and an exception in force,
// when proposed and again when approved), only the settings a type allows,
// proposed with Leave types → Edit and approved with Leave types → Approve,
// both company-wide, never by the proposer (DENIED_SELF), never from support
// view; every proposal and decision audited, messages safe.

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, string> };

const DECISIONS = ['approve', 'final_approve', 'reject', 'withdraw'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath('/timeAndLeave/policies');
  revalidatePath('/timeAndLeave/leaves');
}

async function policyCtx(withCompany = false): Promise<service.PolicyCtx> {
  const scope = await checkPermissionWithScope('VIEW', 'LEAVE_TYPES');
  const [canEdit, canApprove, impersonation] = await Promise.all([hasPermission('EDIT', 'LEAVE_TYPES'), hasPermission('APPROVE', 'LEAVE_TYPES'), getImpersonationSession()]);
  const ctx: service.PolicyCtx = { scope, userId: scope.userId, canEdit, canApprove, impersonation: !!impersonation };
  if (withCompany) {
    // The company comes from the signed-in session, never from the browser.
    const session = await auth();
    ctx.email = session?.user?.email ?? null;
    try {
      ctx.companyId = (await resolvePlatformCompanyForTenant(session?.user?.tenantSlug || undefined)).id;
    } catch {
      ctx.companyId = null;
    }
  }
  return ctx;
}

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.PolicyValidationError || error instanceof ExceptionValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/** What a change would do (in words), the top-up and what stops it. */
export async function previewLeavePolicyAction(input: unknown): Promise<{ success: true; data: PolicyPreview } | Fail> {
  await ensureTenantContext();
  try {
    return { success: true, data: await service.previewChange(input, await policyCtx()) };
  } catch (error: unknown) {
    return fail(error, 'leave-policy.preview');
  }
}

/** Proposes a change to a statutory leave type; it waits for a second person. */
export async function proposeLeavePolicyAction(input: unknown): Promise<{ success: true; data: { id: string; typeName: string; otherApprovers: number } } | Fail> {
  await ensureTenantContext();
  let userId: string | null = null;
  try {
    const ctx = await policyCtx();
    userId = ctx.userId;
    if (ctx.impersonation) throw new UserFacingError("Support view can't change the company's leave policies.");
    const r = await service.proposeChange(input, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'LEAVE_TYPES', recordId: r.id, result: 'SUCCESS', newValues: { proposed: r.typeName, change: (input as { values?: unknown })?.values ?? null, applies: (input as { applies?: unknown })?.applies ?? null } });
    refresh();
    return { success: true, data: r };
  } catch (error: unknown) {
    if (userId && error instanceof service.PolicyValidationError) {
      await recordAuditLog({ userId, action: 'EDIT', module: 'LEAVE_TYPES', recordId: 'leave-policy', result: 'FAILURE', newValues: { refused: Object.keys(error.errors) } });
    }
    return fail(error, 'leave-policy.propose');
  }
}

/** Approve / Final approve / reject (reason) / withdraw waiting changes; each checked and audited on its own. */
export async function decideLeavePolicyAction(ids: unknown, decision: unknown, note?: unknown): Promise<{ success: true; data: { done: number; failed: { id: string; error: string }[] } } | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision as (typeof DECISIONS)[number])) throw new UserFacingError('That is not a valid decision.');
    const list = Array.isArray(ids) ? [...new Set(ids.map(String))].filter((id) => UUID.test(id)).slice(0, 50) : [];
    if (!list.length) throw new UserFacingError('Choose at least one change.');
    const ctx = await policyCtx();
    const d = decision as service.PolicyDecision;
    const results = await service.decideChanges(list, d, typeof note === 'string' ? note.slice(0, 500) : null, ctx);
    const auditAction = d === 'withdraw' ? 'EDIT' : 'APPROVE';
    for (const r of results) {
      if (r.ok) await recordAuditLog({ userId: ctx.userId, action: auditAction, module: 'LEAVE_TYPES', recordId: r.id, result: 'SUCCESS', newValues: { decision: d, leaveType: r.typeName, status: r.status } });
      else if (r.refusal === 'self') await recordAuditLog({ userId: ctx.userId, action: auditAction, module: 'LEAVE_TYPES', recordId: r.id, result: DENIED_SELF, newValues: { decision: d } });
      else if (r.refusal === 'permission') await recordAuditLog({ userId: ctx.userId, action: auditAction, module: 'LEAVE_TYPES', recordId: r.id, result: 'DENIED_PERMISSION', newValues: { decision: d } });
    }
    const done = results.filter((r) => r.ok).length;
    if (done) refresh();
    const failed = results.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error ?? 'Not changed.' }));
    if (!done && failed.length === 1) return { success: false, error: failed[0].error };
    return { success: true, data: { done, failed } };
  } catch (error: unknown) {
    return fail(error, 'leave-policy.decide');
  }
}

/**
 * Asks the platform for an exception to one Labour Act minimum, with the
 * directive (4.6d). Company-wide Leave types → Edit, never support view; the
 * company comes from the session. Audited.
 */
export async function requestLeaveExceptionAction(input: unknown): Promise<{ success: true; data: { id: string; typeName: string } } | Fail> {
  await ensureTenantContext();
  try {
    const ctx = await policyCtx(true);
    const r = await service.requestException(input, ctx);
    const i = (input ?? {}) as Record<string, unknown>;
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'LEAVE_TYPES', recordId: r.id, result: 'SUCCESS', newValues: { exceptionRequested: r.typeName, setting: i.setting ?? null, value: i.value ?? null, legalBasis: i.legalBasis ?? null, from: i.validFrom ?? null, until: i.validUntil ?? null } });
    refresh();
    return { success: true, data: r };
  } catch (error: unknown) {
    return fail(error, 'leave-policy.requestException');
  }
}

/** Withdraws the company's own waiting exception request. Audited. */
export async function cancelLeaveExceptionRequestAction(requestId: unknown): Promise<{ success: true } | Fail> {
  await ensureTenantContext();
  try {
    if (typeof requestId !== 'string' || !UUID.test(requestId)) throw new UserFacingError('Choose a request.');
    const ctx = await policyCtx(true);
    await service.cancelExceptionAsk(requestId, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'LEAVE_TYPES', recordId: requestId, result: 'SUCCESS', newValues: { exceptionRequestWithdrawn: true } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'leave-policy.cancelException');
  }
}
