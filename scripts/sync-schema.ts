import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { decryptCredential } from '../lib/platform/crypto';
import { ensureTenantSchema } from '../lib/db/tenant-schema-sync';

dotenv.config({ path: '.env' });

async function syncSchema() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  console.log('🔄 Connecting to primary database...');
  const sql = postgres(dbUrl, { max: 1 });

  try {
    // 1. Safe synchronization of any platform-level tables
    const [hasRoles] = await sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') AS exists;
    `;
    if (hasRoles?.exists) {
      await sql`ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_protected" boolean DEFAULT false NOT NULL;`;
    }

    // 2. Check if this is a multi-tenant platform database
    const [tableCheck] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'companies'
      ) AS has_companies;
    `;

    if (tableCheck?.has_companies) {
      console.log('🏢 Multi-tenant control plane detected. Fetching active tenant databases...');
      const tenantDbs = await sql`
        SELECT 
          c.id, 
          c.name, 
          c.slug, 
          td.db_name, 
          td.db_user, 
          td.db_password_encrypted, 
          td.db_host, 
          td.db_port, 
          td.db_ssl
        FROM companies c
        JOIN tenant_databases td ON td.company_id = c.id
        WHERE c.status = 'ACTIVE'
      `;

      console.log(`Found ${tenantDbs.length} active tenant database(s) to sync.`);

      for (const t of tenantDbs) {
        console.log(`\n⏳ Syncing schema for tenant: "${t.name}" (${t.slug}) -> database: "${t.db_name}"...`);
        try {
          const dbPassword = decryptCredential(t.db_password_encrypted);
          let dbHost = t.db_host || '127.0.0.1';
          let dbPort = t.db_port || 5432;
          const dbUser = t.db_user || 'postgres';
          const dbName = t.db_name;

          if ((dbHost === '127.0.0.1' || dbHost === 'localhost') && process.env.DATABASE_URL) {
            try {
              const parsedMain = new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://'));
              if (parsedMain.hostname && parsedMain.hostname !== '127.0.0.1' && parsedMain.hostname !== 'localhost') {
                dbHost = parsedMain.hostname;
                if (parsedMain.port) dbPort = Number(parsedMain.port);
              }
            } catch {}
          }

          const tenantUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
          const tenantSql = postgres(tenantUrl, { max: 1 });

          try {
            await ensureTenantSchema(tenantSql);
            console.log(`   ✅ Tenant "${t.name}" synced successfully.`);
          } finally {
            await tenantSql.end();
          }
        } catch (tenantErr) {
          console.error(`   ❌ Failed syncing tenant "${t.name}":`, tenantErr);
        }
      }
    } else {
      console.log('Single database environment detected. Syncing tenant tables directly...');
      await ensureTenantSchema(sql);
      console.log('✅ Direct database schema synced successfully.');
    }

    console.log('\n🎉 All schema migrations & self-healing updates completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema Sync Failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

syncSchema();
