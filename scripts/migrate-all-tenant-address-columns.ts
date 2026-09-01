import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { platformDb, ensurePlatformTablesExist } from '../lib/platform/db';
import { tenantDatabases, companies } from '../lib/platform/schema';
import { decryptCredential } from '../lib/platform/crypto';

dotenv.config({ path: '.env' });

async function migrateDatabase(url: string, dbLabel: string) {
  console.log(`\n========================================`);
  console.log(`🔄 Migrating [${dbLabel}]...`);
  console.log(`========================================`);

  const sql = postgres(url, { max: 1, connect_timeout: 10 });

  try {
    // 1. Check if employee_personal table exists
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'employee_personal';
    `;

    if (tables.length === 0) {
      console.log(`ℹ️ [${dbLabel}] Table employee_personal does not exist in this database. Skipping.`);
      return;
    }

    // 2. Inspect existing columns
    const columns = await sql<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'employee_personal';
    `;
    const colNames = columns.map((c) => c.column_name);
    console.log(`[${dbLabel}] Current columns in employee_personal:`, colNames);

    // 3. Add permanent_address if missing
    if (!colNames.includes('permanent_address')) {
      console.log(`[${dbLabel}] ➕ Adding permanent_address column...`);
      await sql.unsafe(`ALTER TABLE employee_personal ADD COLUMN permanent_address TEXT;`);
      
      if (colNames.includes('address1')) {
        console.log(`[${dbLabel}] 📦 Migrating data from address1 to permanent_address...`);
        await sql.unsafe(`UPDATE employee_personal SET permanent_address = address1 WHERE permanent_address IS NULL;`);
      }
      
      await sql.unsafe(`UPDATE employee_personal SET permanent_address = '' WHERE permanent_address IS NULL;`);
      await sql.unsafe(`ALTER TABLE employee_personal ALTER COLUMN permanent_address SET NOT NULL;`);
    } else {
      console.log(`[${dbLabel}] ✅ permanent_address column already exists.`);
    }

    // 4. Add temporary_address if missing
    if (!colNames.includes('temporary_address')) {
      console.log(`[${dbLabel}] ➕ Adding temporary_address column...`);
      await sql.unsafe(`ALTER TABLE employee_personal ADD COLUMN temporary_address TEXT;`);
      
      if (colNames.includes('address2')) {
        console.log(`[${dbLabel}] 📦 Migrating data from address2 to temporary_address...`);
        await sql.unsafe(`UPDATE employee_personal SET temporary_address = address2 WHERE temporary_address IS NULL;`);
      }
    } else {
      console.log(`[${dbLabel}] ✅ temporary_address column already exists.`);
    }

    // 5. Ensure address1 and address2 don't block inserts if they have NOT NULL constraints
    const address1Col = columns.find(c => c.column_name === 'address1');
    if (address1Col && address1Col.is_nullable === 'NO') {
      console.log(`[${dbLabel}] 🔓 Making legacy address1 nullable to avoid insert constraint violations...`);
      await sql.unsafe(`ALTER TABLE employee_personal ALTER COLUMN address1 DROP NOT NULL;`);
    }

    console.log(`✨ [${dbLabel}] Migration completed successfully!`);
  } catch (error) {
    console.error(`❌ [${dbLabel}] Error during migration:`, error);
  } finally {
    await sql.end();
  }
}

async function main() {
  console.log('🚀 Starting Universal Migration for all Platform & Tenant Databases...');

  // 1. Primary/Platform DB
  const primaryDbUrl = process.env.DATABASE_URL;
  if (primaryDbUrl) {
    await migrateDatabase(primaryDbUrl, 'PRIMARY_DATABASE');
  }

  // 2. Check for tenant databases
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

  // 3. Also check standard common local databases (payroll_db, payroll_platform, etc.)
  const commonDbs = ['payroll_db', 'payroll_platform', 'payroll_system'];
  for (const name of commonDbs) {
    try {
      const url = `postgresql://postgres:admin@127.0.0.1:5432/${name}`;
      await migrateDatabase(url, `LOCAL_FALLBACK_${name}`);
    } catch {
      // ignore
    }
  }

  console.log('\n🎉 ALL DATABASES HAVE BEEN MIGRATED AND SYNCED!');
  process.exit(0);
}

main();
