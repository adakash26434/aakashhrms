import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases, platformAuditLogs } from '@/lib/platform/schema';
import { closeTenantPool } from '@/lib/db/tenant-pool-manager';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { validatePhoneNumber } from '@/lib/utils/phone';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const [tenantDbRecord] = await platformDb
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.companyId, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      company,
      database: tenantDbRecord
        ? {
            dbName: tenantDbRecord.dbName,
            dbHost: tenantDbRecord.dbHost,
            dbPort: tenantDbRecord.dbPort,
            dbUser: tenantDbRecord.dbUser,
            schemaVersion: tenantDbRecord.schemaVersion,
            lastHealthStatus: tenantDbRecord.lastHealthStatus,
            lastHealthAt: tenantDbRecord.lastHealthAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error getting company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch company details.' },
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

    const [existing] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const updates: Partial<typeof companies.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Lifecycle Action Dispatcher
    const lifecycleAction = body.action as 'SUSPEND' | 'REACTIVATE' | 'ARCHIVE' | 'RESTORE' | undefined;

    if (lifecycleAction === 'SUSPEND') {
      updates.status = 'SUSPENDED';
      updates.suspendedAt = new Date();
      await closeTenantPool(existing.slug);
    } else if (lifecycleAction === 'REACTIVATE') {
      updates.status = 'ACTIVE';
      updates.suspendedAt = null;
    } else if (lifecycleAction === 'ARCHIVE') {
      updates.status = 'ARCHIVED';
      updates.archivedAt = new Date();
      await closeTenantPool(existing.slug);
    } else if (lifecycleAction === 'RESTORE') {
      updates.status = 'ACTIVE';
      updates.archivedAt = null;
    } else if (body.status && ['PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'REJECTED'].includes(body.status)) {
      updates.status = body.status;
      if (body.status !== 'ACTIVE' && existing.status === 'ACTIVE') {
        await closeTenantPool(existing.slug);
      }
    }

    // Editable metadata
    if (body.displayName) updates.displayName = String(body.displayName).trim();
    if (body.legalName) updates.legalName = String(body.legalName).trim();
    if (body.contactEmail) updates.contactEmail = String(body.contactEmail).trim().toLowerCase();
    if (body.contactPhone !== undefined) {
      if (body.contactPhone && String(body.contactPhone).trim()) {
        const phoneVal = validatePhoneNumber(String(body.contactPhone));
        if (!phoneVal.isValid) {
          return NextResponse.json(
            { success: false, error: phoneVal.error || 'Invalid contact phone number format.' },
            { status: 400 }
          );
        }
        updates.contactPhone = phoneVal.formatted || String(body.contactPhone).trim();
      } else {
        updates.contactPhone = null;
      }
    }
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;

    const [updatedCompany] = await platformDb
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();

    // Audit log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: lifecycleAction ? `COMPANY_${lifecycleAction}` : 'COMPANY_UPDATE',
      companyId: id,
      meta: {
        updates,
        previousStatus: existing.status,
        newStatus: updatedCompany.status,
        lifecycleAction,
      },
    });

    return NextResponse.json({
      success: true,
      company: updatedCompany,
      message: lifecycleAction
        ? `Company ${existing.companyCode} status changed to ${updatedCompany.status}.`
        : 'Company details updated successfully.',
    });
  } catch (error: any) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update company.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if called without json payload
    }

    const { confirmCode, purgeDatabase = true } = body || {};

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    // Safety validation: verify confirmation code matches
    if (confirmCode && confirmCode.trim().toUpperCase() !== company.companyCode.toUpperCase()) {
      return NextResponse.json(
        {
          success: false,
          error: `Confirmation code mismatch. Expected "${company.companyCode}", got "${confirmCode}".`,
        },
        { status: 400 }
      );
    }

    // 1. Close active in-memory connection pool
    await closeTenantPool(company.slug);

    // 2. Terminate and drop isolated PostgreSQL database
    const [tenantDbRecord] = await platformDb
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.companyId, id))
      .limit(1);

    let dbDropSuccess = false;
    if (tenantDbRecord && purgeDatabase) {
      try {
        const mainDbUrl = process.env.DATABASE_URL!;
        const urlObj = new URL(mainDbUrl.replace('postgresql://', 'http://'));
        const dbUser = urlObj.username || 'postgres';
        const dbPasswordPlain = urlObj.password || 'admin';
        const dbHost = urlObj.hostname || '127.0.0.1';
        const dbPort = urlObj.port || '5432';

        const adminPgUrl = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/postgres`;
        const adminSql = postgres(adminPgUrl, { max: 1 });

        try {
          // Terminate any active sessions to the target database
          await adminSql.unsafe(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '${tenantDbRecord.dbName}' AND pid <> pg_backend_pid();
          `);
          // Drop the physical database
          await adminSql.unsafe(`DROP DATABASE IF EXISTS "${tenantDbRecord.dbName}"`);
          dbDropSuccess = true;
        } finally {
          await adminSql.end();
        }
      } catch (dropErr: any) {
        console.error(`Notice: Failed to drop database ${tenantDbRecord.dbName}:`, dropErr);
      }
    }

    // 3. Cascade-delete company records in platform DB
    await platformDb.delete(companies).where(eq(companies.id, id));

    // 4. Immutable audit trail
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'COMPANY_PERMANENT_PURGE',
      meta: {
        companyCode: company.companyCode,
        slug: company.slug,
        legalName: company.legalName,
        dbName: tenantDbRecord?.dbName || `pay_t_${company.slug}`,
        dbDropSuccess,
        purgedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Company ${company.companyCode} (${company.legalName}) and database pay_t_${company.slug} permanently purged.`,
      dbDropped: dbDropSuccess,
    });
  } catch (error: any) {
    console.error('Error permanently deleting company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete company.' },
      { status: 500 }
    );
  }
}
