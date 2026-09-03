import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import * as platformSchema from './schema';

let platformDatabaseUrl = process.env.PLATFORM_DATABASE_URL;

if (!platformDatabaseUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^PLATFORM_DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        platformDatabaseUrl = match[1];
        process.env.PLATFORM_DATABASE_URL = platformDatabaseUrl;
      }
    }
  } catch {
    // Ignore fallback failure
  }
}

// Fallback to primary DATABASE_URL if PLATFORM_DATABASE_URL is not set
if (!platformDatabaseUrl) {
  platformDatabaseUrl = process.env.DATABASE_URL;
}

if (!platformDatabaseUrl) {
  throw new Error('Neither PLATFORM_DATABASE_URL nor DATABASE_URL is defined.');
}

if (platformDatabaseUrl.includes('@localhost:')) {
  platformDatabaseUrl = platformDatabaseUrl.replace('@localhost:', '@127.0.0.1:');
}

const globalForPlatformDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  platformDb: ReturnType<typeof drizzle<typeof platformSchema>> | undefined;
};

const conn =
  globalForPlatformDb.conn ??
  postgres(platformDatabaseUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

export const platformDb =
  globalForPlatformDb.platformDb ?? drizzle(conn, { schema: platformSchema });

if (process.env.NODE_ENV !== 'production') {
  globalForPlatformDb.conn = conn;
  globalForPlatformDb.platformDb = platformDb;
}

let initPromise: Promise<void> | null = null;

/**
 * Ensures control plane tables exist and default Super Admin user is seeded.
 * Runs idempotently on first platform request.
 */
export async function ensurePlatformTablesExist(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const targetUrl = platformDatabaseUrl!;
      const urlObj = new URL(targetUrl.replace('postgresql://', 'http://'));
      const dbName = urlObj.pathname.replace('/', '') || 'payroll_platform';
      const dbUser = urlObj.username || 'postgres';
      const dbPassword = urlObj.password || 'admin';
      const dbHost = urlObj.hostname || '127.0.0.1';
      const dbPort = urlObj.port || '5432';

      // 1. Target platform DB is verified directly via targetUrl

      // 2. Ensure control plane tables exist
      const pSql = postgres(targetUrl, { max: 1 });
      try {
        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS platform_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_code VARCHAR(16) NOT NULL UNIQUE,
            legal_name VARCHAR(255) NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            slug VARCHAR(63) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            contact_email VARCHAR(255) NOT NULL,
            contact_phone VARCHAR(50),
            industry_type VARCHAR(50) NOT NULL DEFAULT 'General',
            registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
            notes TEXT,
            policy_pack_version INTEGER NOT NULL DEFAULT 1,
            provisioned_at TIMESTAMP WITH TIME ZONE,
            suspended_at TIMESTAMP WITH TIME ZONE,
            archived_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        // Idempotent column migrations for companies table
        await pSql.unsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry_type VARCHAR(50) NOT NULL DEFAULT 'General';`);
        await pSql.unsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;`);
        await pSql.unsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;`);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS tenant_databases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
            db_name VARCHAR(100) NOT NULL,
            db_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
            db_port INTEGER NOT NULL DEFAULT 5432,
            db_user VARCHAR(100) NOT NULL,
            db_password_encrypted TEXT NOT NULL,
            schema_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
            last_health_status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
            db_size_bytes INTEGER,
            last_health_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        // Idempotent column migrations for tenant_databases table
        await pSql.unsafe(`ALTER TABLE tenant_databases ADD COLUMN IF NOT EXISTS last_health_status VARCHAR(50) DEFAULT 'HEALTHY';`);
        await pSql.unsafe(`ALTER TABLE tenant_databases ADD COLUMN IF NOT EXISTS db_size_bytes INTEGER;`);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS platform_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_platform_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
            meta JSONB,
            ip_address VARCHAR(45),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS provisioning_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
            step VARCHAR(50) NOT NULL,
            error_message TEXT,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS platform_impersonation_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE SET NULL,
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE SET NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            ended_at TIMESTAMP WITH TIME ZONE,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        await pSql.unsafe(`
          CREATE TABLE IF NOT EXISTS platform_policy_packs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            version INTEGER NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            payload JSONB NOT NULL,
            is_published BOOLEAN NOT NULL DEFAULT true,
            published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `);

        // 3. Ensure initial Super Admin account is seeded
        const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@aakashhrms.com').toLowerCase().trim();
        const passwordPlain = process.env.SUPER_ADMIN_PASSWORD || 'SuperPassword123!';
        
        const existingAdmin = await pSql`SELECT id FROM platform_users WHERE email = ${email} LIMIT 1`;
        if (existingAdmin.length === 0) {
          const bcrypt = await import('bcryptjs');
          const hash = await bcrypt.hash(passwordPlain, 12);
          await pSql`
            INSERT INTO platform_users (email, password_hash, name, is_active)
            VALUES (${email}, ${hash}, 'Super Administrator', true)
            ON CONFLICT (email) DO NOTHING
          `;
        }

        // 4. Ensure default Statutory Policy Pack (v1.0) is seeded
        const existingPack = await pSql`SELECT id FROM platform_policy_packs WHERE version = 1 LIMIT 1`;
        if (existingPack.length === 0) {
          const { DEFAULT_NEPAL_POLICY_PACK_V1 } = await import('./policy-pack-data');
          await pSql`
            INSERT INTO platform_policy_packs (version, name, payload, is_published, published_at)
            VALUES (
              ${DEFAULT_NEPAL_POLICY_PACK_V1.version},
              ${DEFAULT_NEPAL_POLICY_PACK_V1.name},
              ${JSON.stringify(DEFAULT_NEPAL_POLICY_PACK_V1)},
              true,
              now()
            )
            ON CONFLICT (version) DO NOTHING
          `;
        }
      } finally {
        await pSql.end();
      }
    } catch (err) {
      console.error('Notice during platform DB table initialization:', err);
      initPromise = null; // reset on error so it retries
      throw err;
    }
  })();

  return initPromise;
}
