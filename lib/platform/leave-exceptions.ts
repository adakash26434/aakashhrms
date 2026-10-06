import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, companyChangeRequests, companyLeaveExceptions, platformAuditLogs, platformUsers } from '@/lib/platform/schema';
import { getTenantDb } from '@/lib/db/tenant-pool-manager';
import { leavePolicyExceptions } from '@/lib/db/schema';
import { exceptionErrors, overlapping, type ExceptionInput } from '@/lib/engines/leave-policy.engine';
import { UserFacingError } from '@/lib/errors/action-error';
import { nepalDateIso } from '@/lib/utils/nepal-time';
import type { PolicyException, PolicySetting } from '@/lib/types/leave-policy';

// Leave exceptions (4.6d). A company asks (a change request of kind
// leave_exception, with the directive); a super admin grants it (may adjust
// the value and dates), rejects it with a reason, or grants one directly. An
// exception lowers one Labour Act minimum for one company between two dates.
// It is never deleted, only revoked with a reason, and every grant and revoke
// is in the platform audit. The company gets a read-only copy
// (leave_policy_exceptions) on every grant, revoke and policy sync: only this
// module writes that copy.

export const LEAVE_EXCEPTION = 'leave_exception';

export class ExceptionValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Leave exception validation failed');
    this.name = 'ExceptionValidationError';
  }
}

type Row = typeof companyLeaveExceptions.$inferSelect;

const iso = (d: unknown) => (d ? String(d).slice(0, 10) : null);

export function toPolicyException(r: Row): PolicyException {
  return {
    id: r.id,
    statutoryCode: r.statutoryCode,
    setting: r.setting as PolicySetting,
    value: r.value === null ? null : Number(r.value),
    legalBasis: r.legalBasis,
    reference: r.reference,
    validFrom: iso(r.validFrom)!,
    validUntil: iso(r.validUntil),
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
  };
}

/** The platform routes' answer for a failure: field errors, a safe message, or a generic one (logged). */
export function exceptionFailure(error: unknown, context: string) {
  if (error instanceof ExceptionValidationError) return NextResponse.json({ success: false, error: 'Check the highlighted fields.', validationErrors: error.errors }, { status: 400 });
  if (error instanceof UserFacingError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  console.error(`[${context}]`, error instanceof Error ? error.message.slice(0, 200) : error);
  return NextResponse.json({ success: false, error: 'Something went wrong. Nothing was changed.' }, { status: 500 });
}

/** Reads and tidies what was sent (the engine decides whether it is acceptable). */
export function readExceptionInput(raw: unknown): ExceptionInput {
  const i = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const n = i.value === null || i.value === '' || i.value === undefined ? null : Number(i.value);
  return {
    statutoryCode: text(i.statutoryCode, 50),
    setting: text(i.setting, 40),
    value: n !== null && Number.isFinite(n) ? n : null,
    legalBasis: text(i.legalBasis, 300),
    reference: text(i.reference, 300),
    validFrom: text(i.validFrom, 10),
    validUntil: text(i.validUntil, 10),
  };
}

/** Copies all of a company's exceptions into its database (read-only there). Returns how many. */
export async function pushToCompany(companyId: string): Promise<number> {
  await ensurePlatformTablesExist();
  const [company] = await platformDb.select({ slug: companies.slug }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return 0;
  const rows = await platformDb.select().from(companyLeaveExceptions).where(eq(companyLeaveExceptions.companyId, companyId));
  if (!rows.length) return 0;
  const tenantDb = await getTenantDb(company.slug);
  if (!tenantDb) throw new UserFacingError("The company's database could not be reached; the exception will be copied at the next policy sync.");
  const now = new Date();
  for (const r of rows) {
    const values = {
      statutoryCode: r.statutoryCode,
      setting: r.setting,
      value: r.value,
      legalBasis: r.legalBasis,
      reference: r.reference,
      validFrom: iso(r.validFrom)!,
      validUntil: iso(r.validUntil),
      revokedAt: r.revokedAt,
      revokeReason: r.revokeReason,
      grantedAt: r.grantedAt,
      syncedAt: now,
    };
    await tenantDb.insert(leavePolicyExceptions).values({ id: r.id, ...values }).onConflictDoUpdate({ target: leavePolicyExceptions.id, set: values });
  }
  await platformDb.update(companyLeaveExceptions).set({ syncedAt: now }).where(eq(companyLeaveExceptions.companyId, companyId));
  return rows.length;
}

/** Copies, but never stops the step that called it (grant / revoke are already saved). */
async function pushQuietly(companyId: string): Promise<boolean> {
  try {
    await pushToCompany(companyId);
    return true;
  } catch (err) {
    console.error('[leave-exceptions] copy to company:', err instanceof Error ? err.message.slice(0, 200) : err);
    return false;
  }
}

async function companyExceptions(companyId: string): Promise<PolicyException[]> {
  return (await platformDb.select().from(companyLeaveExceptions).where(eq(companyLeaveExceptions.companyId, companyId))).map(toPolicyException);
}

/**
 * Grants an exception (directly, or from a company's request). Checked by the
 * engine; refused when it overlaps another exception for the same setting.
 */
export async function grantException(p: { companyId: string; input: ExceptionInput; requestId?: string | null; actorId: string }): Promise<{ id: string; copied: boolean }> {
  await ensurePlatformTablesExist();
  const today = nepalDateIso();
  const errors = exceptionErrors(p.input, today);
  if (Object.keys(errors).length) throw new ExceptionValidationError(errors);
  const [company] = await platformDb.select({ id: companies.id }).from(companies).where(eq(companies.id, p.companyId)).limit(1);
  if (!company) throw new UserFacingError('This company no longer exists.');
  const clash = (await companyExceptions(p.companyId)).find((e) => overlapping(e, { ...p.input, revokedAt: null }));
  if (clash) throw new UserFacingError(`An exception for this setting already runs ${clash.validFrom} to ${clash.validUntil ?? 'open'}. Revoke it first, or choose dates that don't meet.`);

  const id = await platformDb.transaction(async (tx) => {
    if (p.requestId) {
      const done = await tx
        .update(companyChangeRequests)
        .set({ status: 'APPROVED', reviewedByPlatformUserId: p.actorId, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(companyChangeRequests.id, p.requestId), eq(companyChangeRequests.companyId, p.companyId), eq(companyChangeRequests.kind, LEAVE_EXCEPTION), eq(companyChangeRequests.status, 'PENDING')))
        .returning({ id: companyChangeRequests.id });
      if (!done.length) throw new UserFacingError('This request was already reviewed or cancelled.');
    }
    const [row] = await tx
      .insert(companyLeaveExceptions)
      .values({
        companyId: p.companyId,
        requestId: p.requestId ?? null,
        statutoryCode: p.input.statutoryCode,
        setting: p.input.setting,
        value: p.input.value === null ? null : String(p.input.value),
        legalBasis: p.input.legalBasis,
        reference: p.input.reference || null,
        validFrom: p.input.validFrom,
        validUntil: p.input.validUntil,
        grantedBy: p.actorId,
      })
      .returning({ id: companyLeaveExceptions.id });
    await tx.insert(platformAuditLogs).values({
      actorPlatformUserId: p.actorId,
      action: 'LEAVE_EXCEPTION_GRANTED',
      companyId: p.companyId,
      meta: { exceptionId: row.id, requestId: p.requestId ?? null, ...p.input },
    });
    return row.id;
  });
  return { id, copied: await pushQuietly(p.companyId) };
}

/** Rejects a company's request, with the reason the company will see. */
export async function rejectExceptionRequest(p: { requestId: string; reason: string; actorId: string }): Promise<void> {
  await ensurePlatformTablesExist();
  const reason = p.reason.trim().slice(0, 500);
  if (reason.length < 5) throw new ExceptionValidationError({ reason: 'Say why (the company sees it)' });
  const [done] = await platformDb
    .update(companyChangeRequests)
    .set({ status: 'REJECTED', rejectionReason: reason, reviewedByPlatformUserId: p.actorId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(companyChangeRequests.id, p.requestId), eq(companyChangeRequests.kind, LEAVE_EXCEPTION), eq(companyChangeRequests.status, 'PENDING')))
    .returning({ companyId: companyChangeRequests.companyId });
  if (!done) throw new UserFacingError('This request was already reviewed or cancelled.');
  await platformDb.insert(platformAuditLogs).values({ actorPlatformUserId: p.actorId, action: 'LEAVE_EXCEPTION_REQUEST_REJECTED', companyId: done.companyId, meta: { requestId: p.requestId, reason } });
}

/** Revokes an exception from today; the company's setting goes back to the law on its next read. */
export async function revokeException(p: { id: string; reason: string; actorId: string }): Promise<{ copied: boolean }> {
  await ensurePlatformTablesExist();
  const reason = p.reason.trim().slice(0, 500);
  if (reason.length < 5) throw new ExceptionValidationError({ reason: 'Say why (the company sees it)' });
  const [done] = await platformDb
    .update(companyLeaveExceptions)
    .set({ revokedAt: new Date(), revokedBy: p.actorId, revokeReason: reason })
    .where(and(eq(companyLeaveExceptions.id, p.id), isNull(companyLeaveExceptions.revokedAt)))
    .returning({ companyId: companyLeaveExceptions.companyId });
  if (!done) throw new UserFacingError('This exception was already revoked.');
  await platformDb.insert(platformAuditLogs).values({ actorPlatformUserId: p.actorId, action: 'LEAVE_EXCEPTION_REVOKED', companyId: done.companyId, meta: { exceptionId: p.id, reason } });
  return { copied: await pushQuietly(done.companyId) };
}

export interface ExceptionRequestView {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  input: ExceptionInput;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface PlatformExceptionView extends PolicyException {
  companyId: string;
  companyName: string;
  companyCode: string;
  grantedBy: string | null;
  grantedAt: string;
  revokeReason: string | null;
  syncedAt: string | null;
  requestId: string | null;
}

/** Everything the platform's Leave exceptions page shows. */
export async function platformExceptionsPage(): Promise<{ requests: ExceptionRequestView[]; exceptions: PlatformExceptionView[]; companies: { id: string; name: string; code: string }[] }> {
  await ensurePlatformTablesExist();
  const [requests, exceptions, all, users] = await Promise.all([
    platformDb.select().from(companyChangeRequests).where(eq(companyChangeRequests.kind, LEAVE_EXCEPTION)).orderBy(desc(companyChangeRequests.createdAt)).limit(200),
    platformDb.select().from(companyLeaveExceptions).orderBy(desc(companyLeaveExceptions.grantedAt)).limit(500),
    platformDb.select({ id: companies.id, name: companies.displayName, code: companies.companyCode, status: companies.status }).from(companies),
    platformDb.select({ id: platformUsers.id, name: platformUsers.name }).from(platformUsers),
  ]);
  const company = new Map(all.map((c) => [c.id, c]));
  const user = new Map(users.map((u) => [u.id, u.name]));
  return {
    requests: requests.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: company.get(r.companyId)?.name ?? 'Unknown company',
      companyCode: company.get(r.companyId)?.code ?? '',
      input: readExceptionInput(r.proposedValues),
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedByUserEmail,
      requestedAt: r.createdAt.toISOString(),
      reviewedBy: r.reviewedByPlatformUserId ? user.get(r.reviewedByPlatformUserId) ?? null : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      rejectionReason: r.rejectionReason,
    })),
    exceptions: exceptions.map((e) => ({
      ...toPolicyException(e),
      companyId: e.companyId,
      companyName: company.get(e.companyId)?.name ?? 'Unknown company',
      companyCode: company.get(e.companyId)?.code ?? '',
      grantedBy: e.grantedBy ? user.get(e.grantedBy) ?? null : null,
      grantedAt: e.grantedAt.toISOString(),
      revokeReason: e.revokeReason,
      syncedAt: e.syncedAt ? e.syncedAt.toISOString() : null,
      requestId: e.requestId,
    })),
    companies: all.filter((c) => c.status === 'ACTIVE').map((c) => ({ id: c.id, name: c.name, code: c.code })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// The company side (called from company actions, with the company resolved from the session)
// ---------------------------------------------------------------------------

/** A company's request; refused when one for the same setting already waits. */
export async function createExceptionRequest(p: { companyId: string; userId: string | null; email: string; input: ExceptionInput; reason: string; current: Record<string, unknown> }): Promise<string> {
  await ensurePlatformTablesExist();
  const errors = exceptionErrors(p.input, nepalDateIso());
  const reason = p.reason.trim().slice(0, 1000);
  if (reason.length < 8) errors.reason = 'Say why the company needs it (at least a sentence)';
  if (Object.keys(errors).length) throw new ExceptionValidationError(errors);
  const waiting = await platformDb
    .select({ values: companyChangeRequests.proposedValues })
    .from(companyChangeRequests)
    .where(and(eq(companyChangeRequests.companyId, p.companyId), eq(companyChangeRequests.kind, LEAVE_EXCEPTION), eq(companyChangeRequests.status, 'PENDING')));
  if (waiting.some((w) => { const v = readExceptionInput(w.values); return v.statutoryCode === p.input.statutoryCode && v.setting === p.input.setting; })) {
    throw new UserFacingError('A request for this setting is already waiting for the platform.');
  }
  const [row] = await platformDb
    .insert(companyChangeRequests)
    .values({
      companyId: p.companyId,
      kind: LEAVE_EXCEPTION,
      requestedByUserId: p.userId,
      requestedByUserEmail: p.email,
      status: 'PENDING',
      currentValues: p.current,
      proposedValues: { ...p.input },
      reason,
      documentReference: p.input.reference || null,
    })
    .returning({ id: companyChangeRequests.id });
  return row.id;
}

/** Withdraws the company's own waiting request. */
export async function cancelExceptionRequest(p: { companyId: string; requestId: string }): Promise<void> {
  await ensurePlatformTablesExist();
  const [done] = await platformDb
    .update(companyChangeRequests)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(and(eq(companyChangeRequests.id, p.requestId), eq(companyChangeRequests.companyId, p.companyId), eq(companyChangeRequests.kind, LEAVE_EXCEPTION), eq(companyChangeRequests.status, 'PENDING')))
    .returning({ id: companyChangeRequests.id });
  if (!done) throw new UserFacingError('This request was already reviewed or withdrawn.');
}

export interface CompanyExceptionRequest {
  id: string;
  input: ExceptionInput;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  rejectionReason: string | null;
  granted: { value: number | null; validFrom: string; validUntil: string | null } | null;
}

/** The company's own exception requests (newest first). */
export async function exceptionRequestsFor(companyId: string): Promise<CompanyExceptionRequest[]> {
  await ensurePlatformTablesExist();
  const rows = await platformDb
    .select()
    .from(companyChangeRequests)
    .where(and(eq(companyChangeRequests.companyId, companyId), eq(companyChangeRequests.kind, LEAVE_EXCEPTION), inArray(companyChangeRequests.status, ['PENDING', 'REJECTED', 'APPROVED', 'CANCELLED'])))
    .orderBy(desc(companyChangeRequests.createdAt))
    .limit(50);
  const ids = rows.map((r) => r.id);
  const grants = ids.length ? await platformDb.select().from(companyLeaveExceptions).where(inArray(companyLeaveExceptions.requestId, ids)) : [];
  return rows.map((r) => ({
    id: r.id,
    input: readExceptionInput(r.proposedValues),
    reason: r.reason,
    status: r.status,
    requestedBy: r.requestedByUserEmail,
    requestedAt: r.createdAt.toISOString(),
    rejectionReason: r.rejectionReason,
    granted: (() => {
      const g = grants.find((x) => x.requestId === r.id);
      return g ? { value: g.value === null ? null : Number(g.value), validFrom: iso(g.validFrom)!, validUntil: iso(g.validUntil) } : null;
    })(),
  }));
}
