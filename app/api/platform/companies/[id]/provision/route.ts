import { NextResponse } from 'next/server';
import { runProvisioningPipeline } from '@/lib/platform/provisioning/run-provision';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { platformDb } from '@/lib/platform/db';
import { platformAuditLogs } from '@/lib/platform/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authenticated Super Admin session
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Company ID is required.' }, { status: 400 });
    }

    const result = await runProvisioningPipeline(id);

    // Audit log — provisioning action with verified actor
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'COMPANY_PROVISION',
      companyId: id,
      meta: { result },
    });

    return NextResponse.json({ ...result, result });
  } catch (error: any) {
    console.error('Provisioning route error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Provisioning pipeline execution failed.' },
      { status: 500 }
    );
  }
}
