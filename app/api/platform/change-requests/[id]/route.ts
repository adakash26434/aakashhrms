import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companyChangeRequests, companies, platformAuditLogs } from '@/lib/platform/schema';
import { getTenantDb } from '@/lib/db/tenant-pool-manager';
import { syncCompanyTier1Fields } from '@/lib/repositories/company-setup.repository';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    const [req] = await platformDb
      .select()
      .from(companyChangeRequests)
      .where(eq(companyChangeRequests.id, id))
      .limit(1);

    if (!req) {
      return NextResponse.json({ success: false, error: 'Change request not found.' }, { status: 404 });
    }

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, req.companyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        ...req,
        company,
      },
    });
  } catch (error: any) {
    console.error('Error fetching change request detail:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch change request' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;
    const body = await request.json();
    const action = body.action as 'APPROVE' | 'REJECT';

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action ("APPROVE" or "REJECT") is required.' },
        { status: 400 }
      );
    }

    const [req] = await platformDb
      .select()
      .from(companyChangeRequests)
      .where(eq(companyChangeRequests.id, id))
      .limit(1);

    if (!req) {
      return NextResponse.json({ success: false, error: 'Change request not found.' }, { status: 404 });
    }

    if (req.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Cannot review a request with status "${req.status}".` },
        { status: 400 }
      );
    }

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, req.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Associated company not found on platform.' },
        { status: 404 }
      );
    }

    if (action === 'APPROVE') {
      const proposed = req.proposedValues as {
        legalName: string;
        panVatNumber?: string;
        registrationNumber?: string;
        industryType?: string;
        headOfficeAddress?: string;
      };

      if (!proposed?.legalName?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Proposed legal name is invalid or missing.' },
          { status: 400 }
        );
      }

      // 1. Update platformDb.companies
      await platformDb
        .update(companies)
        .set({
          legalName: proposed.legalName.trim(),
          panVatNumber: proposed.panVatNumber?.trim() || null,
          registrationNumber: proposed.registrationNumber?.trim() || null,
          industryType: proposed.industryType?.trim() || company.industryType,
          headOfficeAddress: proposed.headOfficeAddress?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, company.id));

      // 2. Synchronize to tenantDb.systemConfig
      try {
        const tenantDb = await getTenantDb(company.slug);
        if (tenantDb) {
          await syncCompanyTier1Fields(tenantDb, proposed);
        }
      } catch (tenantSyncErr) {
        console.error('Failed to sync changes to tenant database:', tenantSyncErr);
      }

      // 3. Mark change request APPROVED
      const [updatedReq] = await platformDb
        .update(companyChangeRequests)
        .set({
          status: 'APPROVED',
          reviewedByPlatformUserId: actor.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companyChangeRequests.id, id))
        .returning();

      // 4. Audit Log
      await platformDb.insert(platformAuditLogs).values({
        actorPlatformUserId: actor.id,
        action: 'COMPANY_CHANGE_REQUEST_APPROVED',
        companyId: company.id,
        meta: {
          requestId: req.id,
          previousValues: req.currentValues,
          appliedValues: proposed,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Change request approved and synchronized to company database.',
        data: updatedReq,
      });
    }

    if (action === 'REJECT') {
      const reason = body.rejectionReason ? String(body.rejectionReason).trim() : '';
      if (!reason || reason.length < 5) {
        return NextResponse.json(
          { success: false, error: 'Please provide a descriptive reason for rejecting this change request.' },
          { status: 400 }
        );
      }

      // Mark change request REJECTED
      const [updatedReq] = await platformDb
        .update(companyChangeRequests)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedByPlatformUserId: actor.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companyChangeRequests.id, id))
        .returning();

      // Audit Log
      await platformDb.insert(platformAuditLogs).values({
        actorPlatformUserId: actor.id,
        action: 'COMPANY_CHANGE_REQUEST_REJECTED',
        companyId: company.id,
        meta: {
          requestId: req.id,
          rejectionReason: reason,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Change request has been rejected.',
        data: updatedReq,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error reviewing change request:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process change request.' },
      { status: 500 }
    );
  }
}
