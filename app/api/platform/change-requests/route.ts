import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companyChangeRequests, companies, platformUsers } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { eq, desc, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const companyIdFilter = searchParams.get('companyId');

    const conditions = [];
    if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(statusFilter)) {
      conditions.push(eq(companyChangeRequests.status, statusFilter));
    }
    if (companyIdFilter) {
      conditions.push(eq(companyChangeRequests.companyId, companyIdFilter));
    }

    const query = platformDb
      .select({
        id: companyChangeRequests.id,
        companyId: companyChangeRequests.companyId,
        companyCode: companies.companyCode,
        companyDisplayName: companies.displayName,
        companyLegalName: companies.legalName,
        companySlug: companies.slug,
        requestedByUserId: companyChangeRequests.requestedByUserId,
        requestedByUserEmail: companyChangeRequests.requestedByUserEmail,
        status: companyChangeRequests.status,
        currentValues: companyChangeRequests.currentValues,
        proposedValues: companyChangeRequests.proposedValues,
        reason: companyChangeRequests.reason,
        documentReference: companyChangeRequests.documentReference,
        reviewedByPlatformUserId: companyChangeRequests.reviewedByPlatformUserId,
        reviewerName: platformUsers.name,
        reviewedAt: companyChangeRequests.reviewedAt,
        rejectionReason: companyChangeRequests.rejectionReason,
        createdAt: companyChangeRequests.createdAt,
        updatedAt: companyChangeRequests.updatedAt,
      })
      .from(companyChangeRequests)
      .innerJoin(companies, eq(companyChangeRequests.companyId, companies.id))
      .leftJoin(platformUsers, eq(companyChangeRequests.reviewedByPlatformUserId, platformUsers.id))
      .orderBy(desc(companyChangeRequests.createdAt));

    const rows = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching company change requests:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch change requests' },
      { status: 500 }
    );
  }
}
