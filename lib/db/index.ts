import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { getCurrentTenantContext, getRequestScopeTenantDb, setRequestScopeTenantDb } from './tenant-context';
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
  conn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(databaseUrl, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

export const db = globalForDb.db ?? drizzle(conn, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn;
  globalForDb.db = db;
}

/**
 * Returns the active database instance asynchronously.
 * In Multi-Tenant mode, resolves the active tenant's isolated database.
 * In Single-Tenant mode or fallback, returns the primary singleton DB connection.
 *
 * Resolution order:
 *   1. Explicitly provided slug parameter
 *   2. AsyncLocalStorage tenant context (set by dashboard layout wrapper)
 *   3. Request-scope fallback (set by ensureTenantContext or runWithTenantContext)
 *   4. Impersonation cookie
 *   5. Session JWT tenantSlug (resolved via Company Code at login)
 *   6. Primary DB fallback
 */
export async function getDbAsync(slug?: string | null) {
  const isSingleTenant = process.env.SINGLE_TENANT_MODE === 'true';
  if (isSingleTenant) {
    return db;
  }

  // 1. Check explicitly provided tenant slug
  if (slug) {
    const tenantDb = await getTenantDb(slug);
    if (tenantDb) {
      setRequestScopeTenantDb(slug, tenantDb);
      return tenantDb;
    }
  }

  // 2. Check AsyncLocalStorage tenant context (set by layout wrapper during SSR)
  const tenantCtx = getCurrentTenantContext();
  if (tenantCtx?.db) {
    setRequestScopeTenantDb(tenantCtx.tenantSlug, tenantCtx.db);
    return tenantCtx.db;
  }

  // 3. Check request-scope fallback (set per-request for server actions / components)
  const reqScope = getRequestScopeTenantDb();
  if (reqScope?.db) {
    return reqScope.db;
  }

  // 4. Check impersonation cookie
  try {
    const { getImpersonationSession } = await import('@/lib/platform/impersonation');
    const impersonation = await getImpersonationSession();
    if (impersonation?.companySlug) {
      const tenantDb = await getTenantDb(impersonation.companySlug);
      if (tenantDb) {
        setRequestScopeTenantDb(impersonation.companySlug, tenantDb);
        return tenantDb;
      }
    }
  } catch {
    // Ignore
  }

  // 5. Check session JWT for tenantSlug (company-code login flow)
  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    if (session?.user?.tenantSlug) {
      const tenantDb = await getTenantDb(session.user.tenantSlug);
      if (tenantDb) {
        setRequestScopeTenantDb(session.user.tenantSlug, tenantDb);
        return tenantDb;
      }
    }
  } catch {
    // Ignore auth session resolution failures (e.g., during login itself)
  }

  return db;
}

/**
 * Synchronous accessor wrapper.
 * Checks in order:
 *   1. AsyncLocalStorage tenant context (layout render)
 *   2. Request-scope fallback (server actions / RSC)
 *   3. Falls back to primary DB
 */
export function getDb() {
  const isSingleTenant = process.env.SINGLE_TENANT_MODE === 'true';
  if (isSingleTenant) {
    return db;
  }

  // 1. AsyncLocalStorage context (set during layout render)
  const tenantCtx = getCurrentTenantContext();
  if (tenantCtx?.db) {
    setRequestScopeTenantDb(tenantCtx.tenantSlug, tenantCtx.db);
    return tenantCtx.db;
  }

  // 2. Request-scope fallback (set by ensureTenantContext in server actions)
  const reqScope = getRequestScopeTenantDb();
  if (reqScope?.db) {
    return reqScope.db;
  }

  // 3. Fallback to primary DB
  return db;
}

/**
 * Call this at the top of server actions or server components to ensure tenant context is initialized.
 * Checks: Explicit slug -> AsyncLocalStorage -> Request-scope -> Impersonation -> Session JWT tenantSlug
 * and caches the tenant DB in the request-scope fallback so that all subsequent
 * getDb() calls within the same request lifecycle use the correct tenant database.
 */
export async function ensureTenantContext(explicitSlug?: string | null): Promise<void> {
  const isSingleTenant = process.env.SINGLE_TENANT_MODE === 'true';
  if (isSingleTenant) return;

  if (explicitSlug) {
    const tenantDb = await getTenantDb(explicitSlug);
    if (tenantDb) {
      setRequestScopeTenantDb(explicitSlug, tenantDb);
      return;
    }
  }

  // Already have context from layout or a previous call
  const tenantCtx = getCurrentTenantContext();
  if (tenantCtx?.db) {
    setRequestScopeTenantDb(tenantCtx.tenantSlug, tenantCtx.db);
    return;
  }

  const reqScope = getRequestScopeTenantDb();
  if (reqScope?.db) return;

  // Check impersonation cookie
  try {
    const { getImpersonationSession } = await import('@/lib/platform/impersonation');
    const impersonation = await getImpersonationSession();
    if (impersonation?.companySlug) {
      const tenantDb = await getTenantDb(impersonation.companySlug);
      if (tenantDb) {
        setRequestScopeTenantDb(impersonation.companySlug, tenantDb);
        return;
      }
    }
  } catch {
    // Ignore
  }

  // Resolve from session JWT (company-code login flow)
  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    if (session?.user?.tenantSlug) {
      const tenantDb = await getTenantDb(session.user.tenantSlug);
      if (tenantDb) {
        setRequestScopeTenantDb(session.user.tenantSlug, tenantDb);
        return;
      }
    }
  } catch {
    // Outside request scope or during unauthenticated flows
  }
}