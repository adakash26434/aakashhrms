import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDbAsync } from '@/lib/db';
import { runWithTenantContext } from '@/lib/db/tenant-context';
import { platformDb } from '@/lib/platform/db';
import { companies } from '@/lib/platform/schema';
import { runDueJobsForTenant, type TenantTickSummary } from '@/lib/services/jobs.service';
import { logger } from '@/lib/logger';

// Scheduled jobs tick (G6). cPanel cron calls this (no daemon fits Passenger):
//
//   */30 * * * *  curl -fsS -H "Authorization: Bearer $JOBS_TICK_SECRET" https://<host>/api/jobs/tick
//
// `proxy.ts` skips /api, so this handler does its own checks: a constant-time
// bearer-secret comparison (JOBS_TICK_SECRET, >= 24 chars), then every due
// job for every ACTIVE company, each inside its own tenant context and its
// own try/catch. Jobs claim their day first, so overlapping ticks are safe.
// The response carries counts only — never tenant data.

export const dynamic = 'force-dynamic';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

function authorized(request: Request): boolean {
  const secret = process.env.JOBS_TICK_SECRET;
  if (!secret || secret.length < 24) return false;
  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!presented) return false;
  return timingSafeEqual(sha256(secret), sha256(presented));
}

async function tick(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    // 404 like every other guarded API here: no oracle for the secret's existence.
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const totals = { tenants: 0, ran: 0, skipped: 0, errors: 0, tenantErrors: 0 };

  if (process.env.SINGLE_TENANT_MODE === 'true') {
    try {
      const summary = await runDueJobsForTenant();
      totals.tenants = 1;
      collect(totals, summary);
    } catch (error) {
      totals.tenantErrors += 1;
      logger.error('jobs.tick single-tenant failed', { error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    const active = await platformDb.select({ slug: companies.slug }).from(companies).where(eq(companies.status, 'ACTIVE'));
    for (const company of active) {
      totals.tenants += 1;
      try {
        const db = await getDbAsync(company.slug);
        const summary = await runWithTenantContext({ tenantSlug: company.slug, db }, () => runDueJobsForTenant());
        collect(totals, summary);
      } catch (error) {
        // One company's failure never stops the rest; details stay in server logs.
        totals.tenantErrors += 1;
        logger.error('jobs.tick tenant failed', { tenant: company.slug, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return NextResponse.json(totals, { headers: { 'Cache-Control': 'no-store' } });
}

function collect(totals: { ran: number; skipped: number; errors: number }, summary: TenantTickSummary) {
  totals.ran += summary.ran.length;
  totals.skipped += summary.skipped.length;
  totals.errors += summary.errors.length;
}

export async function GET(request: Request) {
  return tick(request);
}

export async function POST(request: Request) {
  return tick(request);
}
