import { NextResponse } from 'next/server';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { getPoolStats } from '@/lib/db/tenant-pool-manager';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies } from '@/lib/platform/schema';
import { eq, count } from 'drizzle-orm';

/**
 * GET /api/platform/health
 *
 * Authenticated endpoint returning pool stats, total tenants, and connection counts.
 * Useful for monitoring as more companies are onboarded (Finding 6.2).
 */
export async function GET(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();

    // Pool stats
    const poolStats = getPoolStats();

    // Company counts by status
    const activeCount = await platformDb
      .select({ count: count() })
      .from(companies)
      .where(eq(companies.status, 'ACTIVE'));

    const pendingCount = await platformDb
      .select({ count: count() })
      .from(companies)
      .where(eq(companies.status, 'PENDING'));

    const suspendedCount = await platformDb
      .select({ count: count() })
      .from(companies)
      .where(eq(companies.status, 'SUSPENDED'));

    const totalCount = await platformDb
      .select({ count: count() })
      .from(companies);

    return NextResponse.json({
      success: true,
      health: {
        timestamp: new Date().toISOString(),
        connectionPools: poolStats,
        companies: {
          total: totalCount[0]?.count || 0,
          active: activeCount[0]?.count || 0,
          pending: pendingCount[0]?.count || 0,
          suspended: suspendedCount[0]?.count || 0,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          singleTenantMode: process.env.SINGLE_TENANT_MODE === 'true',
        },
      },
    });
  } catch (error: any) {
    console.error('Platform health check error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Health check failed.' },
      { status: 500 }
    );
  }
}
