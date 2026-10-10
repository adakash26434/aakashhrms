import { and, desc, eq } from 'drizzle-orm';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, companyChangeRequests } from '@/lib/platform/schema';
import { UserFacingError } from '@/lib/errors/action-error';
import type { LegalChangeRequestView, LegalChangeStatus, LegalDetails } from '@/lib/types/company-setup';

// Company details requests (4.12c, S53): the company side of a change to its legal registration.
// A request is always for the signed-in user's own company (the caller resolves it from the
// session, never from the browser); one waits at a time; the company withdraws only its own
// waiting request. The platform reviews them under Platform → Change requests.

export const COMPANY_DETAILS = 'company_details';

const STATUSES: readonly LegalChangeStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/** The legal details the platform holds for a company. */
export async function legalDetailsOf(companyId: string): Promise<LegalDetails | null> {
  await ensurePlatformTablesExist();
  const [c] = await platformDb.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!c) return null;
  return {
    legalName: c.legalName,
    panVatNumber: c.panVatNumber ?? '',
    registrationNumber: c.registrationNumber ?? '',
    industryType: c.industryType ?? 'General',
    headOfficeAddress: c.headOfficeAddress ?? '',
  };
}

/** Files a request; refused while another one waits (checked under the company row's lock). */
export async function createDetailsRequest(p: { companyId: string; userId: string; email: string; current: LegalDetails; proposed: LegalDetails; reason: string; reference: string }): Promise<string> {
  await ensurePlatformTablesExist();
  return platformDb.transaction(async (tx) => {
    await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, p.companyId)).for('update');
    const [waiting] = await tx
      .select({ id: companyChangeRequests.id })
      .from(companyChangeRequests)
      .where(and(eq(companyChangeRequests.companyId, p.companyId), eq(companyChangeRequests.kind, COMPANY_DETAILS), eq(companyChangeRequests.status, 'PENDING')))
      .limit(1);
    if (waiting) throw new UserFacingError('A request is already waiting for the platform: withdraw it first to send another.');
    const [row] = await tx
      .insert(companyChangeRequests)
      .values({
        companyId: p.companyId,
        kind: COMPANY_DETAILS,
        requestedByUserId: p.userId,
        requestedByUserEmail: p.email,
        status: 'PENDING',
        currentValues: p.current,
        proposedValues: p.proposed,
        reason: p.reason,
        documentReference: p.reference || null,
      })
      .returning({ id: companyChangeRequests.id });
    return row.id;
  });
}

/** Withdraws the company's own waiting request (false: it was reviewed or withdrawn meanwhile). */
export async function cancelDetailsRequest(p: { companyId: string; requestId: string }): Promise<boolean> {
  await ensurePlatformTablesExist();
  const rows = await platformDb
    .update(companyChangeRequests)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(
      and(
        eq(companyChangeRequests.id, p.requestId),
        eq(companyChangeRequests.companyId, p.companyId),
        eq(companyChangeRequests.kind, COMPANY_DETAILS),
        eq(companyChangeRequests.status, 'PENDING')
      )
    )
    .returning({ id: companyChangeRequests.id });
  return rows.length > 0;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** The company's latest request (null: none). */
export async function latestDetailsRequest(companyId: string): Promise<LegalChangeRequestView | null> {
  await ensurePlatformTablesExist();
  const [r] = await platformDb
    .select()
    .from(companyChangeRequests)
    .where(and(eq(companyChangeRequests.companyId, companyId), eq(companyChangeRequests.kind, COMPANY_DETAILS)))
    .orderBy(desc(companyChangeRequests.createdAt))
    .limit(1);
  if (!r) return null;
  const v = (r.proposedValues ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as LegalChangeStatus) : 'PENDING',
    proposed: { legalName: str(v.legalName), panVatNumber: str(v.panVatNumber), registrationNumber: str(v.registrationNumber), industryType: str(v.industryType), headOfficeAddress: str(v.headOfficeAddress) },
    reason: r.reason,
    requestedBy: r.requestedByUserEmail,
    requestedAt: r.createdAt.toISOString(),
    rejectionReason: r.rejectionReason,
  };
}
