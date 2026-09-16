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
    await sql`ALTER TABLE "pay_heads" ADD COLUMN IF NOT EXISTS "is_ssf_employer_head" boolean DEFAULT false NOT NULL;`;
    await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "full_name" varchar(255);`;
    await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "is_supervisor" boolean DEFAULT false NOT NULL;`;
    await sql.unsafe(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='first_name') THEN
          UPDATE "employees" SET "full_name" = TRIM(CONCAT(COALESCE("first_name", ''), ' ', COALESCE("last_name", ''))) WHERE "full_name" IS NULL OR "full_name" = '';
          ALTER TABLE "employees" ALTER COLUMN "first_name" DROP NOT NULL;
          ALTER TABLE "employees" ALTER COLUMN "last_name" DROP NOT NULL;
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ 
      DECLARE
        fy_record RECORD;
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tax_rate_slabs') THEN
          DELETE FROM "tax_rate_slabs" WHERE "category" = 'Widow';
          
          FOR fy_record IN SELECT id FROM fiscal_years WHERE status = 'Active' LOOP
            IF NOT EXISTS (SELECT 1 FROM tax_rate_slabs WHERE fiscal_year_id = fy_record.id AND category = 'Handicapped') THEN
              INSERT INTO tax_rate_slabs (id, fiscal_year_id, category, amount_from, amount_to, rate_percent, fixed_deduction)
              VALUES 
                (gen_random_uuid(), fy_record.id, 'Handicapped', '0', '1500000', '1.00', '0'),
                (gen_random_uuid(), fy_record.id, 'Handicapped', '1500001', '2000000', '10.00', '0'),
                (gen_random_uuid(), fy_record.id, 'Handicapped', '2000001', '3000000', '20.00', '0'),
                (gen_random_uuid(), fy_record.id, 'Handicapped', '3000001', '4500000', '27.00', '0'),
                (gen_random_uuid(), fy_record.id, 'Handicapped', '4500001', NULL, '29.00', '0');
            END IF;
          END LOOP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='system_config') THEN
          UPDATE "system_config" 
          SET "value" = '0' 
          WHERE "key" IN ('insuranceDiscounts.handicappedDiscountPercent', 'statutoryDeductionLimits.handicappedDeductionPercent') 
            AND "value" = '50';
        END IF;
      END $$;
    `);

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
