import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { getCurrentTenantContext } from './tenant-context';
import { getTenantDb } from './tenant-pool-manager';
import * as schema from './schema';

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        databaseUrl = match[1];
        process.env.DATABASE_URL = databaseUrl;
      }
    }
  } catch {
    // Ignore fallback failure
  }
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in the environment variables.');
}

if (databaseUrl.includes('@localhost:')) {
  databaseUrl = databaseUrl.replace('@localhost:', '@127.0.0.1:');
}

const globalForDb = globalThis as unknown as {
  mainDbConn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

const conn =
  globalForDb.mainDbConn ??
  postgres(databaseUrl, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

/**
 * Primary (DATABASE_URL) connection. In multi-tenant mode this is NOT a tenant
 * database — only use it directly from scripts or single-tenant code paths.
 */
export const db = globalForDb.db ?? drizzle(conn, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.mainDbConn = conn;
  globalForDb.db = db;
}

export type TenantDb = PostgresJsDatabase<typeof schema>;

/**
 * Thrown when a tenant database is required but none can be resolved from the
 * current request (no valid impersonation token and no tenant in the session).
 * Multi-tenant mode fails closed: we never fall back to the primary database.
 */
export class TenantContextError extends Error {
  constructor(message = 'Unauthorized: No tenant context for this request') {
    super(message);
    this.name = 'TenantContextError';
  }
}

const isSingleTenantMode = () => process.env.SINGLE_TENANT_MODE === 'true';

interface ResolvedTenant {
  slug: string;
  db: TenantDb;
}

// Per-request memo. Keyed by the request's own cookie store object, so entries
// can never be shared between requests (unlike a process-wide global) and are
// garbage-collected with the request.
const requestTenantMemo = new WeakMap<object, Promise<ResolvedTenant | null>>();

async function resolveTenantFromRequest(): Promise<ResolvedTenant | null> {
  // 1. Super Admin "View company workspace" (signed impersonation token)
  try {
    const { getImpersonationSession } = await import('@/lib/platform/impersonation');
    const impersonation = await getImpersonationSession();
    if (impersonation?.companySlug) {
      const tenantDb = await getTenantDb(impersonation.companySlug);
      if (tenantDb) return { slug: impersonation.companySlug, db: tenantDb };
    }
  } catch {
    // Not in a request scope, or token invalid — fall through
  }

  // 2. Tenant user session (tenantSlug carried in the signed NextAuth JWT)
  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    const slug = session?.user?.tenantSlug;
    if (slug) {
      const tenantDb = await getTenantDb(slug);
      if (tenantDb) return { slug, db: tenantDb };
    }
  } catch {
    // Outside request scope or unauthenticated
  }

  return null;
}

async function resolveRequestTenant(): Promise<ResolvedTenant | null> {
  // Explicit AsyncLocalStorage scope (runWithTenantContext) wins.
  const ctx = getCurrentTenantContext();
  if (ctx?.db) return { slug: ctx.tenantSlug, db: ctx.db };

  let key: object | null = null;
  try {
    const { cookies } = await import('next/headers');
    key = (await cookies()) as unknown as object;
  } catch {
    key = null; // Not inside a Next.js request (scripts, tests)
  }

  if (!key) return resolveTenantFromRequest();

  let pending = requestTenantMemo.get(key);
  if (!pending) {
    pending = resolveTenantFromRequest();
    requestTenantMemo.set(key, pending);
  }
  return pending;
}

/**
 * Returns the database for the current request.
 *
 * - Single-tenant mode: the primary database.
 * - Multi-tenant mode: the tenant resolved from this request (impersonation
 *   token, then session). Throws {@link TenantContextError} when none —
 *   never falls back to the primary database.
 */
export async function getDb(): Promise<TenantDb> {
  if (isSingleTenantMode()) return db;

  const resolved = await resolveRequestTenant();
  if (!resolved) throw new TenantContextError();
  return resolved.db;
}

/**
 * Like {@link getDb}, but an explicit tenant slug (e.g. resolved from the
 * company code during login) takes precedence over the request.
 */
export async function getDbAsync(slug?: string | null): Promise<TenantDb> {
  if (isSingleTenantMode()) return db;

  if (slug) {
    const tenantDb = await getTenantDb(slug);
    if (!tenantDb) throw new TenantContextError(`Unknown or inactive tenant: ${slug}`);
    return tenantDb;
  }

  return getDb();
}

/**
 * Returns the tenant slug for the current request, or null (single-tenant mode
 * or no tenant context).
 */
export async function getCurrentTenantSlug(): Promise<string | null> {
  if (isSingleTenantMode()) return null;
  const resolved = await resolveRequestTenant();
  return resolved?.slug ?? null;
}

/**
 * Resolves (and memoises) the tenant for the current request. Kept for the
 * existing call sites at the top of pages and server actions. It does not
 * throw: access is enforced by getDb() (fails closed) and checkPermission().
 */
export async function ensureTenantContext(): Promise<void> {
  if (isSingleTenantMode()) return;
  try {
    await resolveRequestTenant();
  } catch {
    // Resolution errors surface on the first getDb() call
  }
}
