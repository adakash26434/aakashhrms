import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases, platformAuditLogs } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { runProvisioningPipeline } from '@/lib/platform/provisioning/run-provision';

export async function GET(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();

    const [allCompanies, allTenantDbs] = await Promise.all([
      platformDb.select().from(companies),
      platformDb.select().from(tenantDatabases),
    ]);

    const mainDbUrl = process.env.DATABASE_URL!;
    const adminSql = postgres(mainDbUrl, { max: 1 });

    let postgresDatabases: Array<{ datname: string; size_bytes: number }> = [];
    try {
      const res = await adminSql`
        SELECT 
          datname, 
          pg_database_size(datname) as size_bytes 
        FROM pg_database 
        WHERE datistemplate = false;
      `;
      postgresDatabases = res.map((r: any) => ({
        datname: String(r.datname),
        size_bytes: Number(r.size_bytes || 0),
      }));
    } finally {
      await adminSql.end();
    }

    const pgDbSet = new Set(postgresDatabases.map((d) => d.datname));
    const pgDbMap = new Map(postgresDatabases.map((d) => [d.datname, d.size_bytes]));

    // 1. Analyze each registered company
    const auditSummary = allCompanies.map((comp) => {
      const dbRec = allTenantDbs.find((td) => td.companyId === comp.id);
      const expectedDbName = dbRec?.dbName || `pay_t_${comp.slug}`;
      const physicallyExists = pgDbSet.has(expectedDbName);
      const sizeBytes = pgDbMap.get(expectedDbName) || 0;

      let status: 'HEALTHY' | 'ORPHANED_METADATA' | 'UNPROVISIONED' | 'SUSPENDED' | 'ARCHIVED' = 'HEALTHY';

      if (comp.status === 'PENDING') {
        status = 'UNPROVISIONED';
      } else if (comp.status === 'SUSPENDED') {
        status = 'SUSPENDED';
      } else if (comp.status === 'ARCHIVED') {
        status = 'ARCHIVED';
      } else if (!physicallyExists) {
        status = 'ORPHANED_METADATA';
      }

      return {
        companyId: comp.id,
        companyCode: comp.companyCode,
        displayName: comp.displayName,
        slug: comp.slug,
        companyStatus: comp.status,
        dbName: expectedDbName,
        physicallyExists,
        status,
        sizeBytes,
        sizeFormatted: sizeBytes > 0 ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '—',
      };
    });

    // 2. Identify unlinked pay_t_* databases in PostgreSQL
    const registeredDbNames = new Set(auditSummary.map((s) => s.dbName));
    const unlinkedDatabases = postgresDatabases
      .filter((d) => d.datname.startsWith('pay_t_') && !registeredDbNames.has(d.datname))
      .map((d) => ({
        dbName: d.datname,
        sizeBytes: d.size_bytes,
        sizeFormatted: `${(d.size_bytes / (1024 * 1024)).toFixed(2)} MB`,
      }));

    const totalTenantStorageBytes = auditSummary.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    const totalStorageFormatted = `${(totalTenantStorageBytes / (1024 * 1024)).toFixed(2)} MB`;

    const hasDesync = auditSummary.some((s) => s.status === 'ORPHANED_METADATA') || unlinkedDatabases.length > 0;

    return NextResponse.json({
      success: true,
      hasDesync,
      totalTenantStorageFormatted: totalStorageFormatted,
      summary: auditSummary,
      unlinkedDatabases,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error reconciling databases:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reconcile databases.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const body = await request.json();
    const { action, companyId, dbName } = body || {};

    if (action === 'REPROVISION_MISSING_DB' && companyId) {
      // Re-provision missing database
      const result = await runProvisioningPipeline(companyId);

      await platformDb.insert(platformAuditLogs).values({
        actorPlatformUserId: actor.id,
        action: 'RECONCILE_REPROVISION_SUCCESS',
        companyId,
        meta: { result },
      });

      return NextResponse.json({
        success: true,
        message: `Database ${result.dbName} successfully recreated and provisioned.`,
      });
    }

    if (action === 'CLEANUP_ORPHANED_METADATA' && companyId) {
      await platformDb.delete(companies).where(eq(companies.id, companyId));

      await platformDb.insert(platformAuditLogs).values({
        actorPlatformUserId: actor.id,
        action: 'RECONCILE_CLEANUP_ORPHAN',
        companyId,
        meta: { cleanedAt: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: 'Orphaned control plane record removed cleanly.',
      });
    }

    if (action === 'DROP_UNLINKED_DB' && dbName && dbName.startsWith('pay_t_')) {
      const mainDbUrl = process.env.DATABASE_URL!;
      const urlObj = new URL(mainDbUrl.replace('postgresql://', 'http://'));
      const dbUser = urlObj.username || 'postgres';
      const dbPasswordPlain = urlObj.password || 'admin';
      const dbHost = urlObj.hostname || '127.0.0.1';
      const dbPort = urlObj.port || '5432';

      const adminPgUrl = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/postgres`;
      const adminSql = postgres(adminPgUrl, { max: 1 });

      try {
        await adminSql.unsafe(`
          SELECT pg_terminate_backend(pid) 
          FROM pg_stat_activity 
          WHERE datname = '${dbName}' AND pid <> pg_backend_pid();
        `);
        await adminSql.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await adminSql.end();
      }

      await platformDb.insert(platformAuditLogs).values({
        actorPlatformUserId: actor.id,
        action: 'RECONCILE_DROP_UNLINKED_DB',
        meta: { dbName },
      });

      return NextResponse.json({
        success: true,
        message: `Unlinked database ${dbName} dropped from PostgreSQL.`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid reconciliation action or missing arguments.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error executing reconciliation action:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to execute reconciliation action.' },
      { status: 500 }
    );
  }
}
