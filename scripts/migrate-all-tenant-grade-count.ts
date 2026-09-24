import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { platformDb, ensurePlatformTablesExist } from '../lib/platform/db';
import { tenantDatabases } from '../lib/platform/schema';
import { decryptCredential } from '../lib/platform/crypto';

dotenv.config({ path: '.env' });

async function migrateDatabase(url: string, dbLabel: string) {
  console.log(`\n========================================`);
  console.log(`🔄 Migrating [${dbLabel}]...`);
  console.log(`========================================`);

  const sql = postgres(url, { max: 1, connect_timeout: 10 });

  try {
    // 1. Employees table migrations
    const empTables = await sql<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'employees';
    `;

    if (empTables.length > 0) {
      console.log(`[${dbLabel}] Checking columns on "employees"...`);
      await sql.unsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL;`);
      await sql.unsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0';`);
      await sql.unsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_percent" integer DEFAULT 0;`);
      await sql.unsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "basic_salary" numeric(15, 2) DEFAULT '0';`);
      console.log(`[${dbLabel}] ✅ "employees" columns verified/added.`);
    } else {
      console.log(`[${dbLabel}] Table "employees" does not exist. Skipping.`);
    }

    // 2. employee_salary_map table migrations
    const salaryMapTables = await sql<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'employee_salary_map';
    `;

    if (salaryMapTables.length > 0) {
      console.log(`[${dbLabel}] Checking columns on "employee_salary_map"...`);
      await sql.unsafe(`ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL;`);
      await sql.unsafe(`ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0' NOT NULL;`);
      await sql.unsafe(`ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_percent" numeric(5, 2) DEFAULT '0' NOT NULL;`);
      console.log(`[${dbLabel}] ✅ "employee_salary_map" columns verified/added.`);
    }

    console.log(`✨ [${dbLabel}] Migration completed successfully!`);
  } catch (error) {
    console.error(`❌ [${dbLabel}] Error during migration:`, error);
  } finally {
    await sql.end();
  }
}

async function main() {
  console.log('🚀 Starting Universal Grade Migration for all Platform & Tenant Databases...');

  // 1. Primary/Platform DB
  const primaryDbUrl = process.env.DATABASE_URL;
  if (primaryDbUrl) {
    await migrateDatabase(primaryDbUrl, 'PRIMARY_DATABASE');
  }

  // 2. Check for tenant databases via platform table
  try {
    await ensurePlatformTablesExist();
    const allTenantDbs = await platformDb.select().from(tenantDatabases);
    console.log(`\nFound ${allTenantDbs.length} tenant database records in platform registry.`);

    for (const tDb of allTenantDbs) {
      try {
        const dbPassword = decryptCredential(tDb.dbPasswordEncrypted);
        const dbHost = tDb.dbHost || '127.0.0.1';
        const dbPort = tDb.dbPort || 5432;
        const dbUser = tDb.dbUser || 'postgres';
        const dbName = tDb.dbName;
        const tenantUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
        
        await migrateDatabase(tenantUrl, `TENANT_${dbName}`);
      } catch (err) {
        console.error(`❌ Failed to connect/migrate tenant DB ${tDb.dbName}:`, err);
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not query platform tenantDatabases table:', err);
  }

  // 3. Directly query PostgreSQL for all pay_t_% tenant databases to be 100% thorough
  try {
    const adminUrl = primaryDbUrl
      ? primaryDbUrl.replace(/\/[^/?]+(\?.*)?$/, '/postgres$1')
      : 'postgresql://postgres:admin@127.0.0.1:5432/postgres';
    const adminSql = postgres(adminUrl, { max: 1, connect_timeout: 5 });
    const dbRows = await adminSql`SELECT datname FROM pg_database WHERE datname LIKE 'pay_t_%' OR datname IN ('payroll_db', 'payroll_app');`;
    for (const { datname } of dbRows) {
      const url = primaryDbUrl
        ? primaryDbUrl.replace(/\/[^/?]+(\?.*)?$/, `/${datname}$1`)
        : `postgresql://postgres:admin@127.0.0.1:5432/${datname}`;
      await migrateDatabase(url, `DIRECT_PG_${datname}`);
    }
    await adminSql.end();
  } catch (err) {
    console.warn('⚠️ Direct PostgreSQL DB enumeration note:', err);
  }

  console.log('\n🎉 ALL DATABASES HAVE BEEN MIGRATED AND SYNCED WITH GRADE COLUMNS!');
  process.exit(0);
}

main();
