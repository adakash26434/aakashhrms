import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
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

    if (!tenantDbRecord) {
      return NextResponse.json({
        success: true,
        health: {
          status: 'UNPROVISIONED',
          isOnline: false,
          existsInPostgres: false,
          dbName: `pay_t_${company.slug}`,
          sizeBytes: 0,
          sizeFormatted: '0 MB',
          activeConnections: 0,
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const mainDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:admin@127.0.0.1:5432/payroll_main';
    let dbUser = 'postgres';
    let dbPasswordPlain = 'admin';
    let dbHost = '127.0.0.1';
    let dbPort = '5432';

    try {
      const sanitizedUrl = mainDbUrl.replace(/^postgres(ql)?:\/\//i, 'http://');
      const urlObj = new URL(sanitizedUrl);
      dbUser = urlObj.username || 'postgres';
      dbPasswordPlain = decodeURIComponent(urlObj.password || 'admin');
      dbHost = urlObj.hostname || '127.0.0.1';
      dbPort = urlObj.port || '5432';
    } catch {
      // Keep defaults
    }

    const adminPgUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPasswordPlain)}@${dbHost}:${dbPort}/postgres`;
    let adminSql: ReturnType<typeof postgres> | null = null;

    const startTime = Date.now();
    let existsInPostgres = false;
    let sizeBytes = 0;
    let activeConnections = 0;
    let status: 'HEALTHY' | 'OFFLINE' | 'MISSING' = 'OFFLINE';

    try {
      adminSql = postgres(adminPgUrl, { max: 1, connect_timeout: 3 });

      // 1. Verify existence in PostgreSQL catalog
      const dbCheck = await adminSql`
        SELECT datname FROM pg_database WHERE datname = ${tenantDbRecord.dbName}
      `;
      existsInPostgres = dbCheck.length > 0;

      if (existsInPostgres) {
        status = 'HEALTHY';

        // 2. Query DB size
        const sizeRes = await adminSql`
          SELECT pg_database_size(${tenantDbRecord.dbName}) as size_bytes
        `;
        sizeBytes = Number(sizeRes[0]?.size_bytes || 0);

        // 3. Query active connections
        const connRes = await adminSql`
          SELECT count(*) as active_conns 
          FROM pg_stat_activity 
          WHERE datname = ${tenantDbRecord.dbName}
        `;
        activeConnections = Number(connRes[0]?.active_conns || 0);
      } else {
        status = 'MISSING';
      }
    } catch (err) {
      console.error(`Error querying health for database ${tenantDbRecord.dbName}:`, err);
      status = 'OFFLINE';
    } finally {
      if (adminSql) {
        try {
          await adminSql.end({ timeout: 2 });
        } catch {}
      }
    }

    const latencyMs = Date.now() - startTime;
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeFormatted = sizeBytes > 0 ? `${sizeMb} MB` : '—';

    // Update database health record in platform DB
    await platformDb
      .update(tenantDatabases)
      .set({
        lastHealthStatus: status,
        lastHealthAt: new Date(),
        dbSizeBytes: sizeBytes > 0 ? Math.round(sizeBytes) : null,
      })
      .where(eq(tenantDatabases.id, tenantDbRecord.id));

    return NextResponse.json({
      success: true,
      health: {
        status,
        isOnline: status === 'HEALTHY',
        existsInPostgres,
        dbName: tenantDbRecord.dbName,
        sizeBytes,
        sizeFormatted,
        activeConnections,
        latencyMs,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in tenant health endpoint:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to check database health.' },
      { status: 500 }
    );
  }
}
