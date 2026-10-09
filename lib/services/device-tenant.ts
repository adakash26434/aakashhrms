import { eq } from 'drizzle-orm';
import { getDbAsync } from '@/lib/db';
import { runWithTenantContext } from '@/lib/db/tenant-context';
import { isValidSerial } from '@/lib/engines/device.engine';

// Device → tenant resolution (G3). ADMS devices always call /iclock/* on the
// bare host with only their serial number — no session, no company code — so
// the serial has to find its company. Serials are globally unique per
// physical device; the first match across ACTIVE companies wins and is
// cached for a few minutes (the device re-proves itself on every request:
// the handler re-reads the device row inside that tenant, so a stale cache
// entry can never route punches into a tenant that doesn't own the serial).

const CACHE_TTL_MS = 10 * 60 * 1000;
const serialTenantCache = new Map<string, { slug: string; at: number }>();

async function findTenantForSerial(serialNo: string): Promise<string | null> {
  const cached = serialTenantCache.get(serialNo);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.slug;

  const { platformDb } = await import('@/lib/platform/db');
  const { companies } = await import('@/lib/platform/schema');
  const { attendanceDevices } = await import('@/lib/db/schema');
  const active = await platformDb.select({ slug: companies.slug }).from(companies).where(eq(companies.status, 'ACTIVE'));
  for (const company of active) {
    try {
      const db = await getDbAsync(company.slug);
      const [hit] = await db.select({ id: attendanceDevices.id }).from(attendanceDevices).where(eq(attendanceDevices.serialNo, serialNo)).limit(1);
      if (hit) {
        serialTenantCache.set(serialNo, { slug: company.slug, at: Date.now() });
        return company.slug;
      }
    } catch {
      // A company whose database is unreachable just doesn't match.
    }
  }
  return null;
}

/**
 * Runs `fn` inside the tenant that owns this serial (single-tenant mode runs
 * it directly). Null when the serial is malformed or registered nowhere —
 * the routes answer 404 and the device backs off.
 */
export async function resolveDeviceTenantAndRun<T>(serialNo: string, fn: () => Promise<T | null>): Promise<T | null> {
  if (!isValidSerial(serialNo)) return null;

  if (process.env.SINGLE_TENANT_MODE === 'true') return fn();

  const slug = await findTenantForSerial(serialNo);
  if (!slug) return null;
  const db = await getDbAsync(slug);
  const result = await runWithTenantContext({ tenantSlug: slug, db }, fn);
  // A stale cache entry (device moved between companies) re-resolves once.
  if (result === null && serialTenantCache.has(serialNo)) {
    serialTenantCache.delete(serialNo);
    const fresh = await findTenantForSerial(serialNo);
    if (fresh && fresh !== slug) {
      const freshDb = await getDbAsync(fresh);
      return runWithTenantContext({ tenantSlug: fresh, db: freshDb }, fn);
    }
  }
  return result;
}
