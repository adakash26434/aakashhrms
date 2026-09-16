import postgres from 'postgres';

/**
 * Ensures all enum values and required columns exist on tenant databases.
 * Every query is executed individually outside of multi-statement transaction blocks
 * so that PostgreSQL ALTER TYPE ... ADD VALUE and ALTER TABLE ... ADD COLUMN IF NOT EXISTS
 * succeed without any transaction-abort or PL/pgSQL validation side-effects.
 */
export async function ensureTenantSchema(sql: postgres.Sql): Promise<void> {
  // 1. Enum values for public.module (PostgreSQL requires ALTER TYPE ... ADD VALUE to run outside transaction blocks)
  const moduleEnums = [
    'LEAVE_RULES',
    'LEAVE_TYPES',
    'REPORTS_LEAVE',
    'REPORTS_LOAN',
    'ORG_STRUCTURE',
    'SELF_SERVICE',
  ];

  for (const enumVal of moduleEnums) {
    try {
      await sql.unsafe(`ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS '${enumVal}'`);
    } catch {
      // Ignored if type public.module is not yet created or value is already present
    }
  }

  // 2. Critical authentication & scoping columns on "users" table
  const userColumnQueries = [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar(255)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_id" uuid`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamp`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "delegated_to_user_id" uuid`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "delegated_until" timestamp`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_branch_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_department_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL`,
  ];

  for (const q of userColumnQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if "users" table does not exist yet (before initial migration)
    }
  }

  // 3. Columns on other statutory & employee tables
  const otherColumnQueries = [
    `ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100)`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100)`,
    `ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100)`,
    `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_protected" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "permanent_address" text`,
    `ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "temporary_address" text`,
    `ALTER TABLE "pay_heads" ADD COLUMN IF NOT EXISTS "is_ssf_employer_head" boolean DEFAULT false NOT NULL`,
    `UPDATE "pay_heads" SET "is_ssf_employer_head" = true WHERE ("code" IN ('SSF-ER', 'SSF_ER', 'SSFER') OR ("name" ILIKE '%SSF%' AND "name" ILIKE '%Employer%') OR ("name" ILIKE '%Social Security Fund%' AND "name" ILIKE '%Employer%')) AND ("is_ssf_employer_head" IS NULL OR "is_ssf_employer_head" = false)`,
    `UPDATE "pay_heads" SET "is_ssf_head" = true WHERE ("code" IN ('SSF', 'SSF-EE', 'SSF_EE', 'SSFEE') OR ("name" ILIKE '%Social Security Fund%' AND "type" = 'deduction') OR ("name" ILIKE '%SSF%' AND "type" = 'deduction')) AND ("is_ssf_head" IS NULL OR "is_ssf_head" = false)`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "full_name" varchar(255)`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "is_supervisor" boolean DEFAULT false NOT NULL`,
    `DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='first_name') THEN
        UPDATE "employees" SET "full_name" = TRIM(CONCAT(COALESCE("first_name", ''), ' ', COALESCE("last_name", ''))) WHERE "full_name" IS NULL OR "full_name" = '';
        ALTER TABLE "employees" ALTER COLUMN "first_name" DROP NOT NULL;
        ALTER TABLE "employees" ALTER COLUMN "last_name" DROP NOT NULL;
      END IF;
    END $$;`,
    `DO $$ 
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
    END $$;`,
  ];

  for (const q of otherColumnQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if table does not exist yet
    }
  }
}
