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
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temp_password" text`,
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
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "is_head_office" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "remote_category" varchar(20) DEFAULT 'NONE' NOT NULL`,
    `CREATE TABLE IF NOT EXISTS "shreni_levels" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" varchar(50) NOT NULL UNIQUE,
      "name" varchar(255) NOT NULL,
      "level_number" integer NOT NULL,
      "label_nepali" varchar(255) NOT NULL,
      "description" text,
      "min_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
      "max_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
      "rank_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "shreni_levels_level_number_idx" ON "shreni_levels" ("level_number")`,
    `CREATE INDEX IF NOT EXISTS "shreni_levels_is_active_idx" ON "shreni_levels" ("is_active")`,
    `INSERT INTO "shreni_levels" ("code", "name", "level_number", "label_nepali", "description", "min_salary", "max_salary", "rank_order", "is_active")
    VALUES
      ('S1', 'Level 1 (Support / Operational)', 1, 'तह १ (सहयोगी तह)', 'Entry / Support / Operational Level', '0', '0', 1, true),
      ('S2', 'Level 2 (Junior Assistant)', 2, 'तह २ (कनिष्ठ सहायक)', 'Junior Assistant / Trainee Level', '0', '0', 2, true),
      ('S3', 'Level 3 (Assistant)', 3, 'तह ३ (सहायक तह)', 'Assistant Level', '0', '0', 3, true),
      ('S4', 'Level 4 (Senior Assistant)', 4, 'तह ४ (वरिष्ठ सहायक)', 'Senior Assistant Level', '0', '0', 4, true),
      ('S5', 'Level 5 (Supervisor / Jr. Officer)', 5, 'तह ५ (सुपरभाइजर / कनिष्ठ अधिकृत)', 'Supervisor / Junior Officer Level', '0', '0', 5, true),
      ('S6', 'Level 6 (Officer)', 6, 'तह ६ (अधिकृत तह)', 'Officer Level', '0', '0', 6, true),
      ('S7', 'Level 7 (Senior Officer)', 7, 'तह ७ (वरिष्ठ अधिकृत)', 'Senior Officer Level', '0', '0', 7, true),
      ('S8', 'Level 8 (Assistant Manager)', 8, 'तह ८ (सहायक प्रबन्धक)', 'Assistant Manager Level', '0', '0', 8, true),
      ('S9', 'Level 9 (Deputy Manager)', 9, 'तह ९ (उप-प्रबन्धक)', 'Deputy Manager Level', '0', '0', 9, true),
      ('S10', 'Level 10 (Manager)', 10, 'तह १० (प्रबन्धक)', 'Manager Level', '0', '0', 10, true),
      ('S11', 'Level 11 (Senior Manager / Director)', 11, 'तह ११ (वरिष्ठ प्रबन्धक / निर्देशक)', 'Senior Manager / Director Level', '0', '0', 11, true),
      ('S12', 'Level 12 (Executive / General Manager)', 12, 'तह १२ (कार्यकारी / महाप्रबन्धक)', 'Executive / General Manager Level', '0', '0', 12, true),
      ('S13', 'Level 13 (Deputy Executive Head)', 13, 'तह १३ (उप-कार्यकारी प्रमुख)', 'Deputy Executive / Division Head', '0', '0', 13, true),
      ('S14', 'Level 14 (Executive Director)', 14, 'तह १४ (कार्यकारी निर्देशक)', 'Executive Director / VP Level', '0', '0', 14, true),
      ('S15', 'Level 15 (Chief Executive Officer)', 15, 'तह १५ (प्रमुख कार्यकारी अधिकृत)', 'Chief Executive Officer / C-Suite Apex', '0', '0', 15, true)
    ON CONFLICT ("code") DO UPDATE
    SET "name" = EXCLUDED."name",
        "label_nepali" = EXCLUDED."label_nepali",
        "description" = EXCLUDED."description",
        "level_number" = EXCLUDED."level_number"
    WHERE "shreni_levels"."code" IN ('S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14','S15')
      AND ("shreni_levels"."name" != EXCLUDED."name" OR "shreni_levels"."label_nepali" != EXCLUDED."label_nepali")`,
    `CREATE TABLE IF NOT EXISTS "employment_types" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" varchar(50) NOT NULL UNIQUE,
      "name" varchar(100) NOT NULL,
      "name_nepali" varchar(100),
      "is_pf_eligible" boolean DEFAULT true NOT NULL,
      "is_ssf_eligible" boolean DEFAULT true NOT NULL,
      "is_festival_eligible" boolean DEFAULT true NOT NULL,
      "is_leave_eligible" boolean DEFAULT true NOT NULL,
      "is_ot_eligible" boolean DEFAULT true NOT NULL,
      "notice_period_days" integer DEFAULT 30 NOT NULL,
      "probation_months" integer DEFAULT 6 NOT NULL,
      "rank_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "employment_types_is_active_idx" ON "employment_types" ("is_active")`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0'`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_percent" integer DEFAULT 0`,
    `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "basic_salary" numeric(15, 2) DEFAULT '0'`,
    `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_percent" numeric(5, 2) DEFAULT '0' NOT NULL`,
  ];

  for (const q of otherColumnQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if table does not exist yet
    }
  }
}
