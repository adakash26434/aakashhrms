import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function syncSchema() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  console.log('🔄 Syncing multi-tenant schema columns directly on primary database...');
  const sql = postgres(dbUrl, { max: 1 });

  try {
    await sql`ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;`;
    await sql`ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);`;
    await sql`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;`;
    await sql`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);`;
    await sql`ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;`;
    await sql`ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);`;
    await sql`ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_protected" boolean DEFAULT false NOT NULL;`;

    console.log('✅ Primary Database Schema Sync Successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema Sync Failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

syncSchema();
