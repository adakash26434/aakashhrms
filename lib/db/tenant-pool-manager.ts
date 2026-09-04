import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { tenantDatabases, companies } from '@/lib/platform/schema';
import { decryptCredential } from '@/lib/platform/crypto';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

type TenantDrizzleInstance = ReturnType<typeof drizzle<typeof schema>>;

interface TenantPoolEntry {
  sql: postgres.Sql;
  db: TenantDrizzleInstance;
  lastUsedAt: number;
  /** Timestamp of the last status re-validation against the platform DB */
  lastStatusCheckAt: number;
}

const globalForTenantPool = globalThis as unknown as {
  tenantPools: Map<string, TenantPoolEntry> | undefined;
};

const tenantPools = globalForTenantPool.tenantPools ?? new Map<string, TenantPoolEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalForTenantPool.tenantPools = tenantPools;
}

/**
 * How often (in ms) to re-verify a cached tenant pool's company is still ACTIVE.
 * Defense-in-depth: ensures suspended companies are evicted even if the
 * PATCH handler's closeTenantPool call was somehow missed (Finding 6.3).
 */
const STATUS_RECHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves or creates a cached Drizzle ORM database instance for an active tenant.
 * Queries platform control plane to resolve connection parameters and decrypts credentials.
 *
 * Defense-in-depth (Finding 6.3): cached pools are periodically re-validated
 * against the company's status to ensure suspended companies are evicted promptly.
 */
export async function getTenantDb(slug: string): Promise<TenantDrizzleInstance | null> {
  const normalizedSlug = slug.toLowerCase().trim();

  // 1. Check in-memory pool cache first
  const cached = tenantPools.get(normalizedSlug);
  if (cached) {
    const now = Date.now();
    cached.lastUsedAt = now;

    // Defense-in-depth: periodically re-check that the company is still ACTIVE
    if (now - cached.lastStatusCheckAt > STATUS_RECHECK_INTERVAL_MS) {
      try {
        await ensurePlatformTablesExist();
        const [companyRecord] = await platformDb
          .select({ status: companies.status })
          .from(companies)
          .where(eq(companies.slug, normalizedSlug))
          .limit(1);

        if (!companyRecord || companyRecord.status !== 'ACTIVE') {
          // Company is no longer active — evict the cached pool
          await closeTenantPool(normalizedSlug);
          return null;
        }

        cached.lastStatusCheckAt = now;
      } catch {
        // If the status check fails, continue using the cached pool
        // (better to serve than to break on a transient query error)
      }
    }

    return cached.db;
  }

  // Ensure control plane tables exist
  await ensurePlatformTablesExist();

  // 2. Fetch tenant company & database details from platform registry
  const [companyRecord] = await platformDb
    .select()
    .from(companies)
    .where(eq(companies.slug, normalizedSlug))
    .limit(1);

  if (!companyRecord || companyRecord.status !== 'ACTIVE') {
    return null;
  }

  const [tenantDbRecord] = await platformDb
    .select()
    .from(tenantDatabases)
    .where(eq(tenantDatabases.companyId, companyRecord.id))
    .limit(1);

  if (!tenantDbRecord) {
    return null;
  }

  // 3. Decrypt database password
  const dbPassword = decryptCredential(tenantDbRecord.dbPasswordEncrypted);
  const dbHost = tenantDbRecord.dbHost || '127.0.0.1';
  const dbPort = tenantDbRecord.dbPort || 5432;
  const dbUser = tenantDbRecord.dbUser || 'postgres';
  const dbName = tenantDbRecord.dbName;

  const tenantConnectionUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

  // 4. Instantiate postgres connection with conservative pool settings
  const sql = postgres(tenantConnectionUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Idempotent column check for address fields and users authentication fields
  try {
    await sql.unsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_personal') THEN
          ALTER TABLE employee_personal ADD COLUMN IF NOT EXISTS permanent_address TEXT;
          IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee_personal' AND column_name = 'address1') THEN
            UPDATE employee_personal SET permanent_address = address1 WHERE permanent_address IS NULL AND address1 IS NOT NULL;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee_personal' AND column_name = 'address1' AND is_nullable = 'NO') THEN
              ALTER TABLE employee_personal ALTER COLUMN address1 DROP NOT NULL;
            END IF;
          END IF;
          UPDATE employee_personal SET permanent_address = '' WHERE permanent_address IS NULL;
          ALTER TABLE employee_personal ALTER COLUMN permanent_address SET NOT NULL;
          ALTER TABLE employee_personal ADD COLUMN IF NOT EXISTS temporary_address TEXT;
          IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee_personal' AND column_name = 'address2') THEN
            UPDATE employee_personal SET temporary_address = address2 WHERE temporary_address IS NULL AND address2 IS NOT NULL;
          END IF;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS delegated_to_user_id UUID;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS delegated_until TIMESTAMP;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_branch_ids TEXT[] DEFAULT ARRAY[]::text[] NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_department_ids TEXT[] DEFAULT ARRAY[]::text[] NOT NULL;
        END IF;
      END $$;
    `);
  } catch (syncErr) {
    console.warn('[TENANT_SCHEMA_SYNC] Idempotent schema sync note:', syncErr);
  }

  const db = drizzle(sql, { schema });

  const now = Date.now();
  const entry: TenantPoolEntry = {
    sql,
    db,
    lastUsedAt: now,
    lastStatusCheckAt: now,
  };

  tenantPools.set(normalizedSlug, entry);
  return db;
}

/**
 * Closes and removes a cached tenant database connection pool (e.g. during maintenance).
 */
export async function closeTenantPool(slug: string): Promise<void> {
  const normalizedSlug = slug.toLowerCase().trim();
  const entry = tenantPools.get(normalizedSlug);
  if (entry) {
    try {
      await entry.sql.end({ timeout: 5 });
    } catch {
      // Ignore disconnect errors
    } finally {
      tenantPools.delete(normalizedSlug);
    }
  }
}

// ---------------------------------------------------------------------------
// Pool monitoring (Finding 6.2)
// ---------------------------------------------------------------------------

export interface PoolStats {
  totalPools: number;
  /** Estimated total connections: each pool has max=5 */
  estimatedTotalConnections: number;
  pools: Array<{
    slug: string;
    lastUsedAt: number;
    lastStatusCheckAt: number;
    idleSeconds: number;
  }>;
}

/**
 * Returns statistics about all active tenant connection pools.
 * Useful for monitoring connection counts as more companies onboard.
 */
export function getPoolStats(): PoolStats {
  const now = Date.now();
  const pools: PoolStats['pools'] = [];

  for (const [slug, entry] of tenantPools) {
    pools.push({
      slug,
      lastUsedAt: entry.lastUsedAt,
      lastStatusCheckAt: entry.lastStatusCheckAt,
      idleSeconds: Math.round((now - entry.lastUsedAt) / 1000),
    });
  }

  // Sort by most recently used
  pools.sort((a, b) => b.lastUsedAt - a.lastUsedAt);

  return {
    totalPools: tenantPools.size,
    estimatedTotalConnections: tenantPools.size * 5,
    pools,
  };
}
