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
    'HR_LETTERS',
    'PERFORMANCE',
    'RECRUITMENT',
    'WELFARE_FUNDS',
    'DISCIPLINE',
    'TRAINING',
    'ASSETS',
    'NOTICE_BOARD',
    'TRAVEL',
    'TARGETS',
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

  // SECURITY (S2): plaintext temporary passwords are no longer stored. Purge
  // any values written by older versions. Idempotent and cheap once empty.
  try {
    await sql.unsafe(`UPDATE "users" SET "temp_password" = NULL WHERE "temp_password" IS NOT NULL`);
  } catch {
    // Ignored if "users" table does not exist yet
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

  // Salary structure (4.4, migration 0037): revisions, change batches, templates.
  for (const q of [
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'approved' NOT NULL`,
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "batch_id" uuid`,
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "reason" text`,
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "approved_by" uuid`,
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "approved_at" timestamp`,
      `ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_manual" boolean DEFAULT false NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "employee_salary_map_batch_id_idx" ON "employee_salary_map" ("batch_id")`,
      `CREATE TABLE IF NOT EXISTS "salary_change_batches" (
  "id" uuid PRIMARY KEY NOT NULL,
  "kind" varchar(20) NOT NULL,
  "effective_from" date NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "employee_count" integer DEFAULT 0 NOT NULL,
  "monthly_change" numeric(15, 2) DEFAULT '0' NOT NULL,
  "prepared_by" uuid,
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
      `CREATE INDEX IF NOT EXISTS "salary_change_batches_status_idx" ON "salary_change_batches" ("status")`,
      `CREATE TABLE IF NOT EXISTS "salary_templates" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(50) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "level_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "designation_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "basic_mode" varchar(20) DEFAULT 'amount' NOT NULL,
  "basic_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
  "scheme" varchar(10) DEFAULT 'keep' NOT NULL,
  "heads" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
)`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if the table does not exist yet
    }
  }

  // Approvals (4.4 follow-up, migration 0038): the flow kept on each salary change batch,
  // how it was approved, and the approval_actions timeline. Same statements as the
  // migration; all idempotent (backfills touch only rows not yet filled).
  for (const q of [
    `ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_route" varchar(20)`,
    `ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_type" varchar(20)`,
    `ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL`,
    `ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "current_level" integer DEFAULT 0 NOT NULL`,
    `CREATE TABLE IF NOT EXISTS "approval_actions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "module" varchar(40) NOT NULL,
  "request_id" uuid NOT NULL,
  "level" integer DEFAULT 0 NOT NULL,
  "actor_id" uuid,
  "on_behalf_of" uuid,
  "action" varchar(20) NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS "approval_actions_request_idx" ON "approval_actions" ("module", "request_id")`,
    `UPDATE "salary_change_batches" SET "approval_route" = 'simple' WHERE "approval_route" = 'second_person'`,
    `UPDATE "salary_change_batches" SET "approval_route" = 'final_approve' WHERE "approval_route" = 'administrator'`,
    `UPDATE "salary_change_batches" SET "approval_route" = CASE
  WHEN "kind" = 'hire' THEN 'on_hire'
  WHEN "kind" = 'policy' THEN 'policy'
  WHEN "decided_by" IS NOT DISTINCT FROM "prepared_by" THEN 'not_required'
  ELSE 'simple' END
WHERE "status" = 'approved' AND "approval_route" IS NULL`,
    `UPDATE "salary_change_batches" SET "approval_type" = CASE WHEN "kind" IN ('hire', 'policy') OR "approval_route" = 'not_required' THEN 'none' ELSE 'simple' END
WHERE "approval_type" IS NULL`,
    // Only changes made before the timeline existed (no steps of their own): changes saved by the
    // app already have theirs, and a second "Submitted" / decision would show twice on every restart.
    `INSERT INTO "approval_actions" ("id", "module", "request_id", "level", "actor_id", "action", "created_at")
SELECT md5(b."id"::text || ':submitted')::uuid, 'SALARY_MAPPING', b."id", 0, b."prepared_by", 'submitted', b."created_at" FROM "salary_change_batches" b
WHERE NOT EXISTS (SELECT 1 FROM "approval_actions" a WHERE a."module" = 'SALARY_MAPPING' AND a."request_id" = b."id" AND a."id" NOT IN (md5(b."id"::text || ':submitted')::uuid, md5(b."id"::text || ':decided')::uuid))
ON CONFLICT ("id") DO NOTHING`,
    `INSERT INTO "approval_actions" ("id", "module", "request_id", "level", "actor_id", "action", "note", "created_at")
SELECT md5(b."id"::text || ':decided')::uuid, 'SALARY_MAPPING', b."id", 0, b."decided_by",
  CASE b."status" WHEN 'approved' THEN (CASE b."approval_route" WHEN 'final_approve' THEN 'final_approved' WHEN 'simple' THEN 'approved' WHEN 'levels' THEN 'approved' ELSE 'not_required' END) ELSE b."status" END,
  b."decision_note", COALESCE(b."decided_at", b."created_at")
FROM "salary_change_batches" b WHERE b."status" <> 'pending'
AND NOT EXISTS (SELECT 1 FROM "approval_actions" a WHERE a."module" = 'SALARY_MAPPING' AND a."request_id" = b."id" AND a."id" NOT IN (md5(b."id"::text || ':submitted')::uuid, md5(b."id"::text || ':decided')::uuid))
ON CONFLICT ("id") DO NOTHING`,
    // Migration 0046: remove the copies the earlier back-fill added to changes that had their own
    // steps (a Submitted copy where there is an own Submitted, a decision copy where there is an own
    // decision). Changes with no steps of their own keep the back-filled ones.
    `DELETE FROM "approval_actions" a
WHERE a."module" = 'SALARY_MAPPING'
  AND a."id" = md5(a."request_id"::text || ':submitted')::uuid
  AND EXISTS (
    SELECT 1 FROM "approval_actions" o
    WHERE o."module" = 'SALARY_MAPPING' AND o."request_id" = a."request_id" AND o."action" = 'submitted'
      AND o."id" NOT IN (md5(a."request_id"::text || ':submitted')::uuid, md5(a."request_id"::text || ':decided')::uuid)
  )`,
    `DELETE FROM "approval_actions" a
WHERE a."module" = 'SALARY_MAPPING'
  AND a."id" = md5(a."request_id"::text || ':decided')::uuid
  AND EXISTS (
    SELECT 1 FROM "approval_actions" o
    WHERE o."module" = 'SALARY_MAPPING' AND o."request_id" = a."request_id" AND o."action" <> 'submitted'
      AND o."id" NOT IN (md5(a."request_id"::text || ':submitted')::uuid, md5(a."request_id"::text || ':decided')::uuid)
  )`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if the table does not exist yet
    }
  }

  // Attendance foundation (4.5a, migration 0039): punches, daily results with HR overrides,
  // adjustments, attendance months and summary columns. Same statements as the migration;
  // all idempotent (old days become overrides once: rows added later default to migrated).
  for (const q of [
    `CREATE TABLE IF NOT EXISTS "attendance_punches" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "punched_at" timestamptz NOT NULL,
  "kind" varchar(10) DEFAULT 'auto' NOT NULL,
  "source" varchar(20) NOT NULL,
  "device_id" varchar(100),
  "ip" varchar(64),
  "latitude" numeric(9, 6),
  "longitude" numeric(9, 6),
  "accuracy_m" integer,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "voided_at" timestamp,
  "voided_by" uuid,
  "void_reason" text
)`,
    `CREATE INDEX IF NOT EXISTS "attendance_punches_emp_time_idx" ON "attendance_punches" ("employee_id", "punched_at")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "attendance_punches_unique_idx" ON "attendance_punches" ("employee_id", "punched_at", "source")`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "day_type" varchar(20)`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "payable" numeric(3, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "unpaid" numeric(3, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "first_in" timestamptz`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "last_out" timestamptz`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "work_minutes" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_minutes" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "early_minutes" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "ot_work_minutes" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "ot_off_minutes" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "rule" text`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_type" varchar(20)`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_reason" text`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_by" uuid`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_at" timestamp`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "migrated" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "attendance_records" ALTER COLUMN "migrated" SET DEFAULT true`,
    `DELETE FROM "attendance_records" a USING "attendance_records" b
WHERE a."employee_id" = b."employee_id" AND a."attendance_date" = b."attendance_date"
  AND (a."updated_at" < b."updated_at" OR (a."updated_at" = b."updated_at" AND a."id"::text < b."id"::text))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_emp_date_uq" ON "attendance_records" ("employee_id", "attendance_date")`,
    `INSERT INTO "attendance_punches" ("id", "employee_id", "punched_at", "kind", "source", "note")
SELECT md5(r."id"::text || ':in')::uuid, r."employee_id",
  ((r."attendance_date"::text || ' ' || to_char(to_timestamp(upper(trim(r."in_time")), CASE WHEN upper(r."in_time") ~ '(AM|PM)' THEN 'HH12:MI AM' ELSE 'HH24:MI' END), 'HH24:MI'))::timestamp AT TIME ZONE 'Asia/Kathmandu'),
  'in', 'manual', 'Recorded before 4.5'
FROM "attendance_records" r
WHERE r."migrated" = false AND r."in_time" ~ '^\\s*\\d{1,2}:\\d{2}\\s*([AaPp][Mm])?\\s*$'
ON CONFLICT DO NOTHING`,
    `INSERT INTO "attendance_punches" ("id", "employee_id", "punched_at", "kind", "source", "note")
SELECT md5(r."id"::text || ':out')::uuid, r."employee_id",
  ((r."attendance_date"::text || ' ' || to_char(to_timestamp(upper(trim(r."out_time")), CASE WHEN upper(r."out_time") ~ '(AM|PM)' THEN 'HH12:MI AM' ELSE 'HH24:MI' END), 'HH24:MI'))::timestamp AT TIME ZONE 'Asia/Kathmandu'),
  'out', 'manual', 'Recorded before 4.5'
FROM "attendance_records" r
WHERE r."migrated" = false AND r."out_time" ~ '^\\s*\\d{1,2}:\\d{2}\\s*([AaPp][Mm])?\\s*$'
ON CONFLICT DO NOTHING`,
    `UPDATE "attendance_records" SET
  "override_type" = CASE "status" WHEN 'Present' THEN 'present' WHEN 'Absent' THEN 'absent' WHEN 'Half Day' THEN 'half_day' WHEN 'On Leave' THEN 'paid_leave' WHEN 'LWOP' THEN 'unpaid_leave' ELSE NULL END,
  "override_reason" = CASE WHEN "status" IN ('Present', 'Absent', 'Half Day', 'On Leave', 'LWOP') THEN 'Recorded before 4.5' ELSE NULL END,
  "override_at" = CASE WHEN "status" IN ('Present', 'Absent', 'Half Day', 'On Leave', 'LWOP') THEN "updated_at" ELSE NULL END,
  "migrated" = true
WHERE "migrated" = false`,
    `CREATE TABLE IF NOT EXISTS "attendance_adjustments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "attendance_date" date NOT NULL,
  "kind" varchar(20) NOT NULL,
  "requested_in" timestamptz,
  "requested_out" timestamptz,
  "reason" text NOT NULL,
  "source" varchar(20) DEFAULT 'hr' NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "prepared_by" uuid,
  "approval_type" varchar(20),
  "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_level" integer DEFAULT 0 NOT NULL,
  "approval_route" varchar(20),
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS "attendance_adjustments_emp_date_idx" ON "attendance_adjustments" ("employee_id", "attendance_date")`,
    `CREATE INDEX IF NOT EXISTS "attendance_adjustments_status_idx" ON "attendance_adjustments" ("status")`,
    `CREATE TABLE IF NOT EXISTS "attendance_periods" (
  "id" uuid PRIMARY KEY NOT NULL,
  "calendar" varchar(2) DEFAULT 'BS' NOT NULL,
  "period_year" integer NOT NULL,
  "period_month" integer NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "days" integer NOT NULL,
  "branch_id" uuid NOT NULL,
  "status" varchar(10) DEFAULT 'open' NOT NULL,
  "closed_by" uuid,
  "closed_at" timestamp,
  "reopened_by" uuid,
  "reopened_at" timestamp,
  "reopen_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "attendance_periods_unique_idx" ON "attendance_periods" ("calendar", "period_year", "period_month", "branch_id")`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "calendar" varchar(2) DEFAULT 'BS' NOT NULL`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "period_year" integer`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "period_month" integer`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "start_date" date`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "end_date" date`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "calendar_days" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "payable_days" numeric(5, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "unpaid_days" numeric(5, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "not_employed_days" numeric(5, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "summary" jsonb`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "leave_ot_calculations_period_idx" ON "leave_ot_calculations" ("employee_id", "calendar", "period_year", "period_month") WHERE "period_year" IS NOT NULL`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch (err) {
      // Ignored if a table does not exist yet; logged so a failed backfill is visible.
      console.error("[tenant-schema-sync] attendance 0039:", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }

  // Shifts (4.5b, migration 0040): company-defined shifts, dated assignments, a day roster,
  // a branch default and the shift stored on closed days. The General shift is created by
  // the shift service from Company setup the first time shifts are read.
  for (const q of [
    `CREATE TABLE IF NOT EXISTS "shifts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(10) NOT NULL,
  "name" varchar(60) NOT NULL,
  "color" varchar(12) DEFAULT 'green' NOT NULL,
  "kind" varchar(10) DEFAULT 'fixed' NOT NULL,
  "start_time" varchar(5) NOT NULL,
  "end_time" varchar(5) NOT NULL,
  "break_minutes" integer DEFAULT 30 NOT NULL,
  "grace_minutes" integer DEFAULT 15 NOT NULL,
  "full_day_minutes" integer DEFAULT 420 NOT NULL,
  "half_day_minutes" integer DEFAULT 240 NOT NULL,
  "ot_minimum_minutes" integer DEFAULT 30 NOT NULL,
  "week" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "shifts_code_idx" ON "shifts" ("code")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "shifts_one_default_idx" ON "shifts" ("is_default") WHERE "is_default" = true`,
    `CREATE TABLE IF NOT EXISTS "shift_assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "shift_id" uuid NOT NULL REFERENCES "shifts"("id") ON DELETE RESTRICT,
  "from_date" date NOT NULL,
  "to_date" date,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS "shift_assignments_emp_idx" ON "shift_assignments" ("employee_id", "from_date")`,
    `CREATE TABLE IF NOT EXISTS "shift_roster" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "roster_date" date NOT NULL,
  "shift_id" uuid REFERENCES "shifts"("id") ON DELETE RESTRICT,
  "is_off" boolean DEFAULT false NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "shift_roster_emp_date_idx" ON "shift_roster" ("employee_id", "roster_date")`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "default_shift_id" uuid`,
    `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "shift_id" uuid`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch (err) {
      console.error("[tenant-schema-sync] shifts 0040:", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }

  // Web clock-in (4.5c, migration 0041): branch check-in rules, remote check-in location,
  // people allowed to clock in from anywhere.
  for (const q of [
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_rule" varchar(24) DEFAULT 'off' NOT NULL`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_networks" text[] DEFAULT ARRAY[]::text[] NOT NULL`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6)`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6)`,
    `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_radius_m" integer DEFAULT 150 NOT NULL`,
    `ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "ip" varchar(64)`,
    `ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6)`,
    `ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6)`,
    `ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "accuracy_m" integer`,
    `ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "distance_m" integer`,
    `CREATE TABLE IF NOT EXISTS "attendance_checkin_exceptions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "from_date" date NOT NULL,
  "to_date" date,
  "reason" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS "attendance_checkin_exceptions_emp_idx" ON "attendance_checkin_exceptions" ("employee_id")`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch (err) {
      console.error("[tenant-schema-sync] web check-in 0041:", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }

  // Leaves (4.6a, migration 0042): leave type behaviour, substitute / unpaid leave, request
  // detail and approval columns, and the leave ledger (existing balances backfilled once).
  for (const q of [
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "kind" varchar(10)`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "day_basis" varchar(10)`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "paid_days_per_event" numeric(5, 1)`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_per_request" numeric(5, 1)`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "allow_half_day" boolean DEFAULT true NOT NULL`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_right" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "accrual_every_days" integer`,
    `ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "expiry_days" integer`,
    `UPDATE "leave_types" SET
  "kind" = CASE
    WHEN coalesce("statutory_code", "code") IN ('HOME', 'SICK', 'SUBSTITUTE') THEN 'balance'
    WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN 'event'
    WHEN coalesce("statutory_code", "code") = 'PUBLIC' THEN 'none'
    WHEN "leave_type" = 'Non-Pay' THEN 'none'
    ELSE 'balance' END,
  "day_basis" = CASE WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN 'calendar' ELSE 'working' END,
  "paid_days_per_event" = CASE WHEN coalesce("statutory_code", "code") = 'MATERNITY' THEN coalesce("max_paid_days", 60) ELSE NULL END,
  "allow_half_day" = CASE WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN false ELSE true END,
  "is_right" = coalesce("statutory_code", "code") IN ('SICK', 'MATERNITY', 'PATERNITY', 'MOURNING'),
  "accrual_every_days" = CASE WHEN coalesce("statutory_code", "code") = 'HOME' THEN 20 ELSE NULL END,
  "expiry_days" = CASE WHEN coalesce("statutory_code", "code") = 'SUBSTITUTE' THEN 21 ELSE NULL END,
  "is_active" = CASE WHEN coalesce("statutory_code", "code") = 'PUBLIC' THEN false ELSE "is_active" END
WHERE "kind" IS NULL`,
    `INSERT INTO "leave_types" ("id", "name", "code", "leave_type", "no_of_days", "carry_forward", "is_statutory", "statutory_code", "gender_applicable", "is_encashable", "pro_rata_for_new_joinees", "is_platform_locked", "platform_code", "is_active", "kind", "day_basis", "allow_half_day", "is_right", "expiry_days", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Substitute Leave', 'SUBSTITUTE', 'Pay', 0, false, true, 'SUBSTITUTE', 'All', false, false, true, 'SUBSTITUTE', true, 'balance', 'working', true, false, 21, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "leave_types" WHERE "code" = 'SUBSTITUTE' OR "statutory_code" = 'SUBSTITUTE')`,
    `INSERT INTO "leave_types" ("id", "name", "code", "leave_type", "no_of_days", "carry_forward", "is_statutory", "gender_applicable", "is_encashable", "pro_rata_for_new_joinees", "is_platform_locked", "is_active", "kind", "day_basis", "allow_half_day", "is_right", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Unpaid Leave', 'UNPAID', 'Non-Pay', 0, false, false, 'All', false, false, false, true, 'none', 'working', true, false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "leave_types" WHERE "code" = 'UNPAID')`,
    // English-only screens for now: drop the Nepali in brackets from the seeded statutory names.
    `UPDATE "leave_types" SET "name" = btrim(regexp_replace("name", ' *[(][ऀ-ॿ /]+[)]', '', 'g')), "updated_at" = now()
WHERE "statutory_code" IS NOT NULL AND "name" ~ '[ऀ-ॿ]'`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "half" varchar(6)`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "days_detail" jsonb`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "paid_days" numeric(6, 2)`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "unpaid_days" numeric(6, 2)`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'hr' NOT NULL`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "prepared_by" uuid`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_type" varchar(20)`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "current_level" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_route" varchar(20)`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "cancel_reason" text`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "certificate_note" text`,
    `ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "ssf_claim" boolean DEFAULT false NOT NULL`,
    `CREATE TABLE IF NOT EXISTS "leave_ledger" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
  "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "entry_date" date NOT NULL,
  "kind" varchar(20) NOT NULL,
  "days" numeric(6, 2) NOT NULL,
  "application_id" uuid,
  "note" text,
  "expires_on" date,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS "leave_ledger_emp_type_year_idx" ON "leave_ledger" ("employee_id", "leave_type_id", "fiscal_year_id")`,
    `CREATE INDEX IF NOT EXISTS "leave_ledger_application_idx" ON "leave_ledger" ("application_id")`,
    `INSERT INTO "leave_ledger" ("id", "employee_id", "leave_type_id", "fiscal_year_id", "entry_date", "kind", "days", "note", "created_at")
SELECT gen_random_uuid(), b."employee_id", b."leave_type_id", b."fiscal_year_id", (fy."start_date_ad" + interval '12 hours')::date, 'opening', b."allotted" + b."carried_forward", 'Balance before 4.6', now()
FROM "employee_leave_balances" b
JOIN "leave_types" t ON t."id" = b."leave_type_id" AND t."kind" = 'balance'
JOIN "fiscal_years" fy ON fy."id" = b."fiscal_year_id"
WHERE NOT EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."employee_id" = b."employee_id" AND l."leave_type_id" = b."leave_type_id" AND l."fiscal_year_id" = b."fiscal_year_id")`,
    `INSERT INTO "leave_ledger" ("id", "employee_id", "leave_type_id", "fiscal_year_id", "entry_date", "kind", "days", "note", "created_at")
SELECT gen_random_uuid(), b."employee_id", b."leave_type_id", b."fiscal_year_id", (fy."start_date_ad" + interval '12 hours')::date, 'taken', -b."taken", 'Taken before 4.6', now()
FROM "employee_leave_balances" b
JOIN "leave_types" t ON t."id" = b."leave_type_id" AND t."kind" = 'balance'
JOIN "fiscal_years" fy ON fy."id" = b."fiscal_year_id"
WHERE b."taken" > 0
  AND NOT EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."employee_id" = b."employee_id" AND l."leave_type_id" = b."leave_type_id" AND l."fiscal_year_id" = b."fiscal_year_id" AND l."kind" = 'taken' AND l."note" = 'Taken before 4.6')`,
  ]) {
    try {
      await sql.unsafe(q);
    } catch (err) {
      console.error("[tenant-schema-sync] leaves 0042:", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }

  // Leave entitlements (4.6b, migration 0043): ledger refs and leave-year openings. Years
  // with ledger lines count as opened, but only when the table is new: later lines posted
  // into a year that is not open yet must not mark it opened.
  try {
    await sql.unsafe(`ALTER TABLE "leave_ledger" ADD COLUMN IF NOT EXISTS "ref" varchar(80)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "leave_ledger_emp_ref_idx" ON "leave_ledger" ("employee_id", "ref")`);
    const openings = await sql.unsafe(`SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'leave_year_openings'`);
    if (openings.length === 0) {
      await sql.unsafe(`CREATE TABLE IF NOT EXISTS "leave_year_openings" (
  "id" uuid PRIMARY KEY NOT NULL,
  "fiscal_year_id" uuid NOT NULL UNIQUE REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "from_fiscal_year_id" uuid REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "people" integer DEFAULT 0 NOT NULL,
  "note" text,
  "opened_by" uuid,
  "opened_at" timestamp DEFAULT now() NOT NULL
)`);
      await sql.unsafe(`INSERT INTO "leave_year_openings" ("id", "fiscal_year_id", "people", "note", "opened_at")
SELECT gen_random_uuid(), fy."id", (SELECT count(DISTINCT l."employee_id") FROM "leave_ledger" l WHERE l."fiscal_year_id" = fy."id"), 'Opened by 4.6', now()
FROM "fiscal_years" fy
WHERE fy."start_date_ad" <= now()
  AND EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."fiscal_year_id" = fy."id")
  AND NOT EXISTS (SELECT 1 FROM "leave_year_openings" o WHERE o."fiscal_year_id" = fy."id")`);
    }
    await sql.unsafe(`UPDATE "leave_types" SET "accrual_every_days" = 20 WHERE "statutory_code" = 'HOME' AND "accrual_every_days" IS NULL`);
    await sql.unsafe(`UPDATE "leave_types" SET "expiry_days" = 21 WHERE "statutory_code" = 'SUBSTITUTE' AND "expiry_days" IS NULL`);
  } catch (err) {
    console.error("[tenant-schema-sync] leaves 0043:", err instanceof Error ? err.message.slice(0, 200) : err);
  }

  // Leave policies (4.6c–e, migration 0044): every change to a leave type as a version
  // (second-person approval for statutory types), platform exceptions copied read-only,
  // company leave type fields; statutory types apply to everyone. The leave_rules copy
  // runs only when the columns are new, so later edits are never overwritten.
  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "leave_type_changes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "applies" varchar(20) DEFAULT 'approval' NOT NULL,
  "effective_from" date,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "source" varchar(20) DEFAULT 'company' NOT NULL,
  "exception_id" uuid,
  "prepared_by" uuid,
  "prepared_at" timestamp DEFAULT now() NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "approval_route" varchar(20),
  "approval_type" varchar(20),
  "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_level" integer DEFAULT 0 NOT NULL,
  "applied_at" timestamp
)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "leave_type_changes_type_idx" ON "leave_type_changes" ("leave_type_id", "status")`);
    await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "leave_type_changes_one_pending" ON "leave_type_changes" ("leave_type_id") WHERE "status" = 'pending'`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "leave_policy_exceptions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "statutory_code" varchar(50) NOT NULL,
  "setting" varchar(40) NOT NULL,
  "value" numeric(7, 1),
  "legal_basis" text NOT NULL,
  "reference" text,
  "valid_from" date NOT NULL,
  "valid_until" date,
  "revoked_at" timestamp,
  "revoke_reason" text,
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "synced_at" timestamp DEFAULT now() NOT NULL
)`);
    const fresh = await sql.unsafe(`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'leave_types' AND column_name = 'payout_fixed_amount'`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "notice_days" integer`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "eligible_after_days" integer`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "credit_mode" varchar(10) DEFAULT 'yearly' NOT NULL`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_per_year" numeric(5, 1)`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_in_service" numeric(6, 1)`);
    await sql.unsafe(`ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "payout_fixed_amount" numeric(15, 2)`);
    await sql.unsafe(`UPDATE "leave_types" SET "applicable_departments" = ARRAY[]::text[], "applicable_designations" = ARRAY[]::text[]
WHERE "is_statutory" = true AND (cardinality("applicable_departments") > 0 OR cardinality("applicable_designations") > 0)`);
    if (fresh.length === 0) {
      await sql.unsafe(`UPDATE "leave_types" t SET "eligible_after_days" = r."min_service_days_for_eligibility"
FROM "leave_rules" r
WHERE r."leave_type_id" = t."id" AND t."is_statutory" = false AND t."eligible_after_days" IS NULL AND COALESCE(r."min_service_days_for_eligibility", 0) > 0`);
      await sql.unsafe(`UPDATE "leave_types" t SET "encashment_basis" = 'Fixed', "payout_fixed_amount" = r."encashment_fixed_amount"
FROM "leave_rules" r
WHERE r."leave_type_id" = t."id" AND t."is_statutory" = false AND t."payout_fixed_amount" IS NULL AND r."encashment_rate" = 'FIXED_AMOUNT'`);
    }
  } catch (err) {
    console.error("[tenant-schema-sync] leaves 0044:", err instanceof Error ? err.message.slice(0, 200) : err);
  }

  // Employee documents and photo (4.2b, migration 0045): a list of identity documents with their scans.
  // The old employee_personal columns are copied only when the table is new; afterwards they
  // are a mirror written on every save.
  try {
    const existing = await sql.unsafe(`SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'employee_documents'`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "employee_documents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "doc_type" varchar(20) NOT NULL,
  "doc_number" varchar(100) NOT NULL,
  "issued_district" varchar(100) NOT NULL,
  "issued_date" date,
  "issuing_office" varchar(150) DEFAULT '' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_documents_employee_type_key" UNIQUE ("employee_id", "doc_type")
)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_idx" ON "employee_documents" ("employee_id")`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "employee_document_files" (
  "id" uuid PRIMARY KEY NOT NULL,
  "document_id" uuid REFERENCES "employee_documents"("id") ON DELETE CASCADE,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE CASCADE,
  "side" varchar(10) NOT NULL,
  "file_name" varchar(150) NOT NULL,
  "mime_type" varchar(50) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "content" bytea NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_document_files_document_side_key" UNIQUE ("document_id", "side")
)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "employee_document_files_document_id_idx" ON "employee_document_files" ("document_id")`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "employee_document_files_uploaded_by_idx" ON "employee_document_files" ("uploaded_by", "uploaded_at")`);
    // Second version of 4.2b: issuing office, one scan per document, the photo.
    await sql.unsafe(`ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "issuing_office" varchar(150) DEFAULT '' NOT NULL`);
    await sql.unsafe(`UPDATE "employee_document_files" SET "side" = 'scan' WHERE "side" = 'front'`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "employee_photos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE CASCADE,
  "mime_type" varchar(50) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "content" bytea NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_photos_employee_key" UNIQUE ("employee_id")
)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "employee_photos_uploaded_by_idx" ON "employee_photos" ("uploaded_by", "uploaded_at")`);
    if (existing.length === 0) {
      await sql.unsafe(`INSERT INTO "employee_documents" ("id", "employee_id", "doc_type", "doc_number", "issued_district")
SELECT md5(p."employee_id"::text || ':' || d."doc_type")::uuid, p."employee_id", d."doc_type", trim(d."no"), COALESCE(trim(d."district"), '')
FROM "employee_personal" p
CROSS JOIN LATERAL (VALUES
  ('citizenship', p."citizenship_no", p."issuing_district"),
  ('nid', p."nid_no", p."nid_issuing_district"),
  ('passport', p."passport_no", p."passport_issuing_district"),
  ('voter_id', p."voters_id", p."voter_id_issuing_district")
) AS d("doc_type", "no", "district")
WHERE COALESCE(trim(d."no"), '') <> ''
ON CONFLICT DO NOTHING`);
    }
  } catch (err) {
    console.error("[tenant-schema-sync] employee documents 0045:", err instanceof Error ? err.message.slice(0, 200) : err);
  }

  // Organization (4.3, migration 0036): company-wide departments and a head picked from
  // employees. When head_employee_id is new, link typed head names that match one employee.
  try {
    await sql.unsafe(`ALTER TABLE "departments" ALTER COLUMN "branch_id" DROP NOT NULL`);
    await sql.unsafe(`ALTER TABLE "departments" ALTER COLUMN "head_name" DROP NOT NULL`);
    await sql.unsafe(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "branch_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL`);
    const head = await sql.unsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'departments' AND column_name = 'head_employee_id'`
    );
    if (head.length === 0) {
      await sql.unsafe(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "head_employee_id" uuid`);
      await sql.unsafe(`UPDATE "departments" d SET "head_employee_id" = m.id
        FROM (SELECT lower(trim(full_name)) AS name, (array_agg(id))[1] AS id FROM "employees" GROUP BY lower(trim(full_name)) HAVING count(*) = 1) m
        WHERE d."head_employee_id" IS NULL AND d."head_name" IS NOT NULL AND lower(trim(d."head_name")) = m.name`);
    }
  } catch {
    // Ignored if the departments table does not exist yet
  }

  // grade_manual (4.2, migration 0035): when the column is new, mark the grades that were
  // typed by hand before it existed (an amount with no grade count), as the migration does.
  try {
    const existing = await sql.unsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'employees' AND column_name = 'grade_manual'`
    );
    if (existing.length === 0) {
      await sql.unsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_manual" boolean DEFAULT false NOT NULL`);
      await sql.unsafe(`UPDATE "employees" SET "grade_manual" = true WHERE "grade_count" = 0 AND COALESCE("grade_amount", 0) > 0`);
    }
  } catch {
    // Ignored if the employees table does not exist yet
  }

  // HR letters (G2, migration 0047): bilingual letter templates, the per-fiscal-year chalani
  // sequence, and issued letters (rendered body frozen; voided, never deleted). Also seeds the
  // HR_LETTERS permission rows (PG10-safe md5 ids) and grants them to System Administrator
  // (all) and HR Manager (VIEW/ADD/EDIT/DELETE); other roles are granted on the Roles screen.
  const hrLetterQueries = [
    `CREATE TABLE IF NOT EXISTS "letter_templates" (
      "id" uuid PRIMARY KEY NOT NULL,
      "code" varchar(30) NOT NULL,
      "name" varchar(100) NOT NULL,
      "name_np" varchar(100) DEFAULT '' NOT NULL,
      "subject_en" varchar(200) NOT NULL,
      "subject_np" varchar(200) DEFAULT '' NOT NULL,
      "body_en" text NOT NULL,
      "body_np" text DEFAULT '' NOT NULL,
      "is_system" boolean DEFAULT false NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "letter_templates_code_unique" UNIQUE ("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "letter_sequences" (
      "id" uuid PRIMARY KEY NOT NULL,
      "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
      "last_seq" integer DEFAULT 0 NOT NULL,
      CONSTRAINT "letter_sequences_fiscal_year_key" UNIQUE ("fiscal_year_id")
    )`,
    `CREATE TABLE IF NOT EXISTS "hr_letters" (
      "id" uuid PRIMARY KEY NOT NULL,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "template_id" uuid REFERENCES "letter_templates"("id") ON DELETE SET NULL,
      "kind" varchar(30) NOT NULL,
      "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
      "seq" integer NOT NULL,
      "letter_number" varchar(50) NOT NULL,
      "language" varchar(2) NOT NULL,
      "subject" varchar(200) NOT NULL,
      "body" text NOT NULL,
      "merge_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "status" varchar(10) DEFAULT 'issued' NOT NULL,
      "issued_date_bs" varchar(20) NOT NULL,
      "issued_date_ad" date NOT NULL,
      "issued_by" uuid NOT NULL,
      "issued_at" timestamp DEFAULT now() NOT NULL,
      "voided_by" uuid,
      "voided_at" timestamp,
      "void_reason" text,
      CONSTRAINT "hr_letters_fiscal_year_seq_key" UNIQUE ("fiscal_year_id", "seq")
    )`,
    `CREATE INDEX IF NOT EXISTS "hr_letters_employee_id_idx" ON "hr_letters" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "hr_letters_issued_at_idx" ON "hr_letters" ("issued_at")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':HR_LETTERS')::uuid, a::action, 'HR_LETTERS'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'HR_LETTERS'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of hrLetterQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist (before the initial migration),
      // or while the HR_LETTERS enum value from this run's step 1 is not yet visible
      // (PG10 requires a new enum value's transaction to commit before use; every
      // statement here runs individually, so the next sync pass completes it).
    }
  }

  // Employee lifecycle events (G2, migration 0048): promotion / transfer / confirmation
  // as dated events with before/after snapshots; scheduled events are applied on read.
  const employeeEventQueries = [
    `CREATE TABLE IF NOT EXISTS "employee_events" (
      "id" uuid PRIMARY KEY NOT NULL,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "kind" varchar(20) NOT NULL,
      "effective_date_ad" date NOT NULL,
      "effective_date_bs" varchar(20) NOT NULL,
      "from_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "to_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "reason" text,
      "status" varchar(10) DEFAULT 'applied' NOT NULL,
      "letter_id" uuid REFERENCES "hr_letters"("id") ON DELETE SET NULL,
      "created_by" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "applied_at" timestamp,
      "cancelled_by" uuid,
      "cancelled_at" timestamp,
      "cancel_reason" text
    )`,
    `CREATE INDEX IF NOT EXISTS "employee_events_employee_id_idx" ON "employee_events" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "employee_events_due_idx" ON "employee_events" ("status", "effective_date_ad")`,
  ];
  for (const q of employeeEventQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist (before the initial migration).
    }
  }

  // Performance evaluation (G1, migration 0049): cycles, evaluations with the form frozen
  // at start, marks per criterion per stage, plus the PERFORMANCE permission module
  // (md5 ids; granted to System Administrator and HR Manager — the 0047 pattern).
  const performanceQueries = [
    `CREATE TABLE IF NOT EXISTS "evaluation_templates" (
      "id" uuid PRIMARY KEY NOT NULL,
      "code" varchar(30) NOT NULL,
      "name" varchar(100) NOT NULL,
      "name_np" varchar(100) DEFAULT '' NOT NULL,
      "form" jsonb NOT NULL,
      "is_system" boolean DEFAULT false NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "evaluation_templates_code_unique" UNIQUE ("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "evaluation_cycles" (
      "id" uuid PRIMARY KEY NOT NULL,
      "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
      "label" varchar(100) NOT NULL,
      "period" varchar(20) DEFAULT 'annual' NOT NULL,
      "status" varchar(10) DEFAULT 'open' NOT NULL,
      "opened_by" uuid NOT NULL,
      "opened_at" timestamp DEFAULT now() NOT NULL,
      "closed_by" uuid,
      "closed_at" timestamp,
      CONSTRAINT "evaluation_cycles_year_label_key" UNIQUE ("fiscal_year_id", "label")
    )`,
    `CREATE TABLE IF NOT EXISTS "evaluations" (
      "id" uuid PRIMARY KEY NOT NULL,
      "cycle_id" uuid NOT NULL REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "form" jsonb NOT NULL,
      "raters" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "stage" varchar(20) NOT NULL,
      "status" varchar(12) DEFAULT 'in_progress' NOT NULL,
      "totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "started_by" uuid NOT NULL,
      "started_at" timestamp DEFAULT now() NOT NULL,
      "finalized_by" uuid,
      "finalized_at" timestamp,
      CONSTRAINT "evaluations_cycle_employee_key" UNIQUE ("cycle_id", "employee_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "evaluations_employee_id_idx" ON "evaluations" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "evaluations_stage_idx" ON "evaluations" ("status", "stage")`,
    `CREATE TABLE IF NOT EXISTS "evaluation_scores" (
      "id" uuid PRIMARY KEY NOT NULL,
      "evaluation_id" uuid NOT NULL REFERENCES "evaluations"("id") ON DELETE CASCADE,
      "stage" varchar(20) NOT NULL,
      "criterion_id" varchar(40) NOT NULL,
      "marks" numeric(5,2) NOT NULL,
      "note" text,
      "rated_by" uuid NOT NULL,
      "rated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "evaluation_scores_cell_key" UNIQUE ("evaluation_id", "stage", "criterion_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "evaluation_scores_evaluation_id_idx" ON "evaluation_scores" ("evaluation_id")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':PERFORMANCE')::uuid, a::action, 'PERFORMANCE'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'PERFORMANCE'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of performanceQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the PERFORMANCE enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Scheduled jobs (G6, migration 0050): per-tenant job state and run log for
  // the /api/jobs/tick automation (cron curl; no daemon on cPanel).
  const jobQueries = [
    `CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
      "id" uuid PRIMARY KEY NOT NULL,
      "code" varchar(40) NOT NULL,
      "enabled" boolean DEFAULT true NOT NULL,
      "last_run_day" varchar(10),
      "last_run_at" timestamp,
      "last_status" varchar(10),
      "last_detail" text,
      CONSTRAINT "scheduled_jobs_code_unique" UNIQUE ("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "job_runs" (
      "id" uuid PRIMARY KEY NOT NULL,
      "job_code" varchar(40) NOT NULL,
      "started_at" timestamp DEFAULT now() NOT NULL,
      "finished_at" timestamp,
      "status" varchar(10) DEFAULT 'running' NOT NULL,
      "detail" text,
      "items_processed" integer DEFAULT 0 NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "job_runs_job_code_idx" ON "job_runs" ("job_code", "started_at")`,
  ];
  for (const q of jobQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist (before the initial migration).
    }
  }

  // Attendance devices (G3, migration 0051): ZKTeco ADMS push — device registry,
  // PIN ↔ employee mapping and the unmatched-punch holding table.
  const deviceQueries = [
    `CREATE TABLE IF NOT EXISTS "attendance_devices" (
      "id" uuid PRIMARY KEY NOT NULL,
      "name" varchar(100) NOT NULL,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
      "serial_no" varchar(60) NOT NULL,
      "enabled" boolean DEFAULT true NOT NULL,
      "tz_offset_minutes" integer DEFAULT 345 NOT NULL,
      "last_seen_at" timestamp,
      "last_punch_at" timestamptz,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "attendance_devices_serial_no_unique" UNIQUE ("serial_no")
    )`,
    `CREATE TABLE IF NOT EXISTS "device_users" (
      "id" uuid PRIMARY KEY NOT NULL,
      "device_id" uuid NOT NULL REFERENCES "attendance_devices"("id") ON DELETE CASCADE,
      "device_user_id" varchar(30) NOT NULL,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "device_users_device_pin_key" UNIQUE ("device_id", "device_user_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "device_users_employee_id_idx" ON "device_users" ("employee_id")`,
    `CREATE TABLE IF NOT EXISTS "device_unmatched_punches" (
      "id" uuid PRIMARY KEY NOT NULL,
      "device_id" uuid NOT NULL REFERENCES "attendance_devices"("id") ON DELETE CASCADE,
      "device_user_id" varchar(30) NOT NULL,
      "punched_at" timestamptz NOT NULL,
      "raw" varchar(200) DEFAULT '' NOT NULL,
      "received_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "device_unmatched_punches_key" UNIQUE ("device_id", "device_user_id", "punched_at")
    )`,
    `CREATE INDEX IF NOT EXISTS "device_unmatched_punches_device_idx" ON "device_unmatched_punches" ("device_id", "received_at")`,
  ];
  for (const q of deviceQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist (before the initial migration).
    }
  }

  // Exit workflow (G5, migration 0052): exit cases with a per-unit clearance checklist.
  const exitQueries = [
    `CREATE TABLE IF NOT EXISTS "exit_cases" (
      "id" uuid PRIMARY KEY NOT NULL,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "kind" varchar(20) NOT NULL,
      "notice_date" date,
      "last_working_day_ad" date NOT NULL,
      "last_working_day_bs" varchar(20) NOT NULL,
      "reason" text,
      "status" varchar(10) DEFAULT 'open' NOT NULL,
      "letter_id" uuid REFERENCES "hr_letters"("id") ON DELETE SET NULL,
      "opened_by" uuid NOT NULL,
      "opened_at" timestamp DEFAULT now() NOT NULL,
      "closed_by" uuid,
      "closed_at" timestamp,
      "cancelled_by" uuid,
      "cancelled_at" timestamp,
      "cancel_reason" text
    )`,
    `CREATE INDEX IF NOT EXISTS "exit_cases_employee_id_idx" ON "exit_cases" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "exit_cases_status_idx" ON "exit_cases" ("status")`,
    `CREATE TABLE IF NOT EXISTS "exit_clearances" (
      "id" uuid PRIMARY KEY NOT NULL,
      "exit_case_id" uuid NOT NULL REFERENCES "exit_cases"("id") ON DELETE CASCADE,
      "unit" varchar(20) NOT NULL,
      "status" varchar(10) DEFAULT 'pending' NOT NULL,
      "note" text,
      "decided_by" uuid,
      "decided_at" timestamp,
      CONSTRAINT "exit_clearances_case_unit_key" UNIQUE ("exit_case_id", "unit")
    )`,
  ];
  for (const q of exitQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist (before the initial migration).
    }
  }

  // Recruitment & darbandi (G4, migration 0053): approved positions, vacancies,
  // applicants, plus the RECRUITMENT permission module (the 0047 pattern).
  const recruitmentQueries = [
    `CREATE TABLE IF NOT EXISTS "approved_positions" (
      "id" uuid PRIMARY KEY NOT NULL,
      "designation_id" uuid NOT NULL REFERENCES "designations"("id") ON DELETE RESTRICT,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
      "positions" integer NOT NULL,
      "decision_ref" varchar(100) DEFAULT '' NOT NULL,
      "note" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "approved_positions_key" UNIQUE ("designation_id", "branch_id")
    )`,
    `CREATE TABLE IF NOT EXISTS "vacancies" (
      "id" uuid PRIMARY KEY NOT NULL,
      "designation_id" uuid NOT NULL REFERENCES "designations"("id") ON DELETE RESTRICT,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
      "openings" integer DEFAULT 1 NOT NULL,
      "deadline_ad" date,
      "note" text,
      "status" varchar(10) DEFAULT 'open' NOT NULL,
      "opened_by" uuid NOT NULL,
      "opened_at" timestamp DEFAULT now() NOT NULL,
      "closed_by" uuid,
      "closed_at" timestamp
    )`,
    `CREATE INDEX IF NOT EXISTS "vacancies_status_idx" ON "vacancies" ("status")`,
    `CREATE TABLE IF NOT EXISTS "applicants" (
      "id" uuid PRIMARY KEY NOT NULL,
      "vacancy_id" uuid NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
      "full_name" varchar(255) NOT NULL,
      "phone" varchar(50) DEFAULT '' NOT NULL,
      "email" varchar(255) DEFAULT '' NOT NULL,
      "address" varchar(255) DEFAULT '' NOT NULL,
      "education_note" text,
      "stage" varchar(15) DEFAULT 'applied' NOT NULL,
      "exam_marks" numeric(5,2),
      "interview_marks" numeric(5,2),
      "note" text,
      "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "applicants_vacancy_idx" ON "applicants" ("vacancy_id", "stage")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':RECRUITMENT')::uuid, a::action, 'RECRUITMENT'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'RECRUITMENT'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of recruitmentQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the RECRUITMENT enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Disciplinary & grievance cases (G8, migration 0055): cases, their append-only
  // timeline, plus the DISCIPLINE permission module (the 0047 pattern).
  const disciplineQueries = [
    `CREATE TABLE IF NOT EXISTS "hr_cases" (
        "id" uuid PRIMARY KEY NOT NULL,
        "category" varchar(15) NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "severity" varchar(10) NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "status" varchar(15) DEFAULT 'open' NOT NULL,
        "outcome" varchar(30),
        "outcome_note" text,
        "decided_by" uuid,
        "decided_at" timestamp,
        "opened_by" uuid NOT NULL,
        "opened_at" timestamp DEFAULT now() NOT NULL,
        "closed_by" uuid,
        "closed_at" timestamp
      )`,
    `CREATE TABLE IF NOT EXISTS "hr_case_events" (
        "id" uuid PRIMARY KEY NOT NULL,
        "case_id" uuid NOT NULL REFERENCES "hr_cases"("id") ON DELETE CASCADE,
        "kind" varchar(12) NOT NULL,
        "text" text NOT NULL,
        "actor_id" uuid,
        "at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE INDEX IF NOT EXISTS "hr_cases_employee_idx" ON "hr_cases" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "hr_cases_status_idx" ON "hr_cases" ("status")`,
    `CREATE INDEX IF NOT EXISTS "hr_case_events_case_idx" ON "hr_case_events" ("case_id", "at")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':DISCIPLINE')::uuid, a::action, 'DISCIPLINE'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'DISCIPLINE'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of disciplineQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the DISCIPLINE enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Training (G7, migration 0056): programmes and participants, plus the TRAINING
  // permission module (the 0047 pattern).
  const trainingQueries = [
    `CREATE TABLE IF NOT EXISTS "training_programs" (
        "id" uuid PRIMARY KEY NOT NULL,
        "title" varchar(200) NOT NULL,
        "provider" varchar(200) DEFAULT '' NOT NULL,
        "kind" varchar(12) NOT NULL,
        "start_ad" date NOT NULL,
        "end_ad" date NOT NULL,
        "hours" numeric(7,2) NOT NULL,
        "cost" numeric(15,2) DEFAULT 0 NOT NULL,
        "bond_months" integer DEFAULT 0 NOT NULL,
        "note" text,
        "status" varchar(10) DEFAULT 'planned' NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS "training_participants" (
        "id" uuid PRIMARY KEY NOT NULL,
        "program_id" uuid NOT NULL REFERENCES "training_programs"("id") ON DELETE CASCADE,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "status" varchar(10) DEFAULT 'nominated' NOT NULL,
        "score" numeric(5,2),
        "certificate_no" varchar(60),
        "marked_by" uuid,
        "marked_at" timestamp,
        "nominated_by" uuid,
        "nominated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "training_participants_key" UNIQUE ("program_id", "employee_id")
      )`,
    `CREATE INDEX IF NOT EXISTS "training_programs_status_idx" ON "training_programs" ("status")`,
    `CREATE INDEX IF NOT EXISTS "training_participants_employee_idx" ON "training_participants" ("employee_id")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':TRAINING')::uuid, a::action, 'TRAINING'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'TRAINING'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of trainingQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the TRAINING enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Payroll controls (4.8 / F1-F3, migration 0063): publish state on runs, held
  // payslips, variance acknowledgements. Existing locked runs are published once,
  // inside the guarded block that adds the column (never on later passes).
  const payrollControlQueries = [
    `DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_runs' AND column_name = 'published_at') THEN
          ALTER TABLE "payroll_runs" ADD COLUMN "published_at" timestamp;
          ALTER TABLE "payroll_runs" ADD COLUMN "published_by" uuid;
          UPDATE "payroll_runs" SET "published_at" = COALESCE("locked_at", now()) WHERE "status" = 'LOCKED';
        END IF;
      END $$`,
    `ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "held_at" timestamp`,
    `ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "held_by" uuid`,
    `ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "hold_reason" text`,
    `CREATE TABLE IF NOT EXISTS "payroll_variance_acks" (
        "id" uuid PRIMARY KEY NOT NULL,
        "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        "flag_key" varchar(100) NOT NULL,
        "employee_id" uuid NOT NULL,
        "note" text DEFAULT '' NOT NULL,
        "acked_by" uuid NOT NULL,
        "acked_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "payroll_variance_acks_key" UNIQUE ("payroll_run_id", "flag_key")
      )`,
  ];
  for (const q of payrollControlQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until payroll_runs exists; the next sync pass completes it.
    }
  }

  // Arrears (4.8 / F7, migration 0064): back pay paid through a run for earlier
  // finalised months, and the ARREARS system pay head (taxable allowance).
  const arrearsQueries = [
    `CREATE TABLE IF NOT EXISTS "payroll_arrears" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "source_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        "amount" numeric(15,2) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "payroll_arrears_key" UNIQUE ("employee_id", "source_run_id", "payroll_run_id")
      )`,
    `CREATE INDEX IF NOT EXISTS "payroll_arrears_source_idx" ON "payroll_arrears" ("source_run_id", "employee_id")`,
    `INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
      SELECT md5('payhead:ARREARS')::uuid, 'ARREARS', 'Arrears (back pay)', 'allowance', true, 'None', 'FixedAmount', 0
      WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'ARREARS')`,
  ];
  for (const q of arrearsQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until payroll_runs exists; the next sync pass completes it.
    }
  }

  // Tax projection (4.8 / F5, migration 0065): the computation sheet kept on each slip.
  try {
    await sql.unsafe(`ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "tax_sheet" jsonb`);
  } catch {
    // Ignored until payroll_slips exists; the next sync pass completes it.
  }

  // Bilingual payslip (4.8 / F11, migration 0069): a pay head's Nepali name.
  try {
    await sql.unsafe(`ALTER TABLE "pay_heads" ADD COLUMN IF NOT EXISTS "name_np" varchar(255)`);
  } catch {
    // Ignored until pay_heads exists; the next sync pass completes it.
  }

  // Pay run types (4.8 / F6, migration 0068): REGULAR / FESTIVAL / ARREARS; existing runs are REGULAR.
  try {
    await sql.unsafe(`ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "run_type" varchar(20) DEFAULT 'REGULAR' NOT NULL`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "payroll_runs_period_type_idx" ON "payroll_runs" ("pay_period_year", "pay_period_month", "run_type")`);
  } catch {
    // Ignored until payroll_runs exists; the next sync pass completes it.
  }

  // Statutory IDs (4.8 / F9, migration 0067): SSF ID, Provident Fund and CIT numbers.
  for (const column of ['ssf_number', 'pf_number', 'cit_number']) {
    try {
      await sql.unsafe(`ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "${column}" varchar(30)`);
    } catch {
      // Ignored until employee_personal exists; the next sync pass completes it.
    }
  }

  // Full & final settlement (4.8 / F8, migration 0066): one frozen statement per exit case.
  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "exit_settlements" (
      "id" uuid PRIMARY KEY NOT NULL,
      "exit_case_id" uuid NOT NULL REFERENCES "exit_cases"("id") ON DELETE CASCADE,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
      "status" varchar(10) DEFAULT 'draft' NOT NULL,
      "lines" jsonb NOT NULL,
      "earnings" numeric(15,2) NOT NULL,
      "deductions" numeric(15,2) NOT NULL,
      "net" numeric(15,2) NOT NULL,
      "tax_sheet" jsonb,
      "policy" jsonb NOT NULL,
      "prepared_by" uuid NOT NULL,
      "prepared_at" timestamp DEFAULT now() NOT NULL,
      "approved_by" uuid,
      "approved_at" timestamp,
      "paid_by" uuid,
      "paid_at" timestamp,
      "payment_ref" varchar(100),
      CONSTRAINT "exit_settlements_case_key" UNIQUE ("exit_case_id")
    )`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "exit_settlements_employee_idx" ON "exit_settlements" ("employee_id")`);
  } catch {
    // Ignored until exit_cases exists; the next sync pass completes it.
  }

  // Targets & achievements (G15, migration 0062): employee targets with the
  // reported / verified achievement, attachments, and the TARGETS permission
  // module (the 0047 pattern).
  const targetQueries = [
    `CREATE TABLE IF NOT EXISTS "employee_targets" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "period_kind" varchar(5) NOT NULL,
        "fy" varchar(9) NOT NULL,
        "month_no" integer,
        "title" varchar(160) NOT NULL,
        "unit" varchar(30) DEFAULT '' NOT NULL,
        "target_value" numeric(18,2) NOT NULL,
        "weight" numeric(5,2) DEFAULT 0 NOT NULL,
        "status" varchar(10) DEFAULT 'set' NOT NULL,
        "achieved_value" numeric(18,2),
        "achieved_note" text,
        "verified_value" numeric(18,2),
        "reviewer_note" text,
        "return_reason" text,
        "submitted_at" timestamp,
        "reviewed_by" uuid,
        "reviewed_at" timestamp,
        "closed_by" uuid,
        "closed_at" timestamp,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS "target_attachments" (
        "id" uuid PRIMARY KEY NOT NULL,
        "target_id" uuid REFERENCES "employee_targets"("id") ON DELETE CASCADE,
        "file_name" varchar(200) NOT NULL,
        "mime" varchar(40) NOT NULL,
        "size" integer NOT NULL,
        "content" bytea NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "uploaded_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE INDEX IF NOT EXISTS "employee_targets_employee_period_idx" ON "employee_targets" ("employee_id", "fy", "period_kind", "month_no")`,
    `CREATE INDEX IF NOT EXISTS "employee_targets_status_idx" ON "employee_targets" ("status")`,
    `CREATE INDEX IF NOT EXISTS "target_attachments_target_idx" ON "target_attachments" ("target_id")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':TARGETS')::uuid, a::action, 'TARGETS'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'TARGETS'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of targetQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the TARGETS enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Assets & notice board (G14, migration 0057): register, handovers, notices,
  // plus the ASSETS and NOTICE_BOARD permission modules (the 0047 pattern).
  const assetNoticeQueries = [
    `CREATE TABLE IF NOT EXISTS "assets" (
        "id" uuid PRIMARY KEY NOT NULL,
        "tag" varchar(50) NOT NULL,
        "name" varchar(200) NOT NULL,
        "category" varchar(30) NOT NULL,
        "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
        "note" text,
        "status" varchar(12) DEFAULT 'available' NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "assets_tag_key" UNIQUE ("tag")
      )`,
    `CREATE TABLE IF NOT EXISTS "asset_handovers" (
        "id" uuid PRIMARY KEY NOT NULL,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "issued_ad" date NOT NULL,
        "returned_ad" date,
        "condition" varchar(12),
        "note" text,
        "issued_by" uuid,
        "returned_by" uuid
      )`,
    `CREATE TABLE IF NOT EXISTS "notices" (
        "id" uuid PRIMARY KEY NOT NULL,
        "title" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "branch_id" uuid REFERENCES "branches"("id") ON DELETE CASCADE,
        "publish_ad" date NOT NULL,
        "expires_ad" date,
        "pinned" boolean DEFAULT false NOT NULL,
        "status" varchar(10) DEFAULT 'published' NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status")`,
    `CREATE INDEX IF NOT EXISTS "asset_handovers_employee_idx" ON "asset_handovers" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "asset_handovers_asset_idx" ON "asset_handovers" ("asset_id")`,
    `CREATE INDEX IF NOT EXISTS "notices_publish_idx" ON "notices" ("status", "publish_ad")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':ASSETS')::uuid, a::action, 'ASSETS'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'ASSETS'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':NOTICE_BOARD')::uuid, a::action, 'NOTICE_BOARD'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'NOTICE_BOARD'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
      WHERE r."slug" IN ('system_admin', 'hr_manager')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  // Notice audiences (migration 0061): company | branch | department | named employees.
  assetNoticeQueries.push(
    `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "audience" varchar(12) DEFAULT 'company' NOT NULL`,
    `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE CASCADE`,
    `UPDATE "notices" SET "audience" = 'branch' WHERE "branch_id" IS NOT NULL AND "audience" = 'company'`,
    `CREATE TABLE IF NOT EXISTS "notice_recipients" (
        "notice_id" uuid NOT NULL REFERENCES "notices"("id") ON DELETE CASCADE,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        PRIMARY KEY ("notice_id", "employee_id")
      )`,
    `CREATE INDEX IF NOT EXISTS "notice_recipients_employee_idx" ON "notice_recipients" ("employee_id")`,
  );
  for (const q of assetNoticeQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the enum values from
      // step 1 are committed (the next sync pass completes it).
    }
  }

  // TA-DA (G11, migration 0058): rate cards and travel claims, plus the TRAVEL
  // permission module (the 0047 pattern).
  const travelQueries = [
    `CREATE TABLE IF NOT EXISTS "travel_rates" (
        "id" uuid PRIMARY KEY NOT NULL,
        "name" varchar(100) NOT NULL,
        "designation_id" uuid REFERENCES "designations"("id") ON DELETE CASCADE,
        "daily_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
        "lodging_per_night" numeric(12,2) DEFAULT 0 NOT NULL,
        "km_rate" numeric(8,2) DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "travel_rates_designation_key" UNIQUE ("designation_id")
      )`,
    `CREATE TABLE IF NOT EXISTS "travel_claims" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "purpose" varchar(300) NOT NULL,
        "from_place" varchar(120) NOT NULL,
        "to_place" varchar(120) NOT NULL,
        "start_ad" date NOT NULL,
        "end_ad" date NOT NULL,
        "mode" varchar(15) NOT NULL,
        "km" numeric(8,1) DEFAULT 0 NOT NULL,
        "nights" integer DEFAULT 0 NOT NULL,
        "fare_actual" numeric(12,2) DEFAULT 0 NOT NULL,
        "lodging_actual" numeric(12,2) DEFAULT 0 NOT NULL,
        "advance" numeric(12,2) DEFAULT 0 NOT NULL,
        "rate_name" varchar(100) DEFAULT '' NOT NULL,
        "days" integer NOT NULL,
        "daily_allowance" numeric(12,2) NOT NULL,
        "lodging" numeric(12,2) NOT NULL,
        "travel" numeric(12,2) NOT NULL,
        "gross" numeric(12,2) NOT NULL,
        "payable" numeric(12,2) NOT NULL,
        "note" text,
        "status" varchar(10) DEFAULT 'draft' NOT NULL,
        "decision_note" text,
        "decided_by" uuid,
        "decided_at" timestamp,
        "settled_at" timestamp,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE INDEX IF NOT EXISTS "travel_claims_employee_idx" ON "travel_claims" ("employee_id", "start_ad")`,
    `CREATE INDEX IF NOT EXISTS "travel_claims_status_idx" ON "travel_claims" ("status")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':TRAVEL')::uuid, a::action, 'TRAVEL'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'TRAVEL'
        AND (r."slug" = 'system_admin' OR (r."slug" = 'hr_manager' AND p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE')) OR (r."slug" = 'payroll_controller' AND p."action" IN ('VIEW', 'LOCK')))
      WHERE r."slug" IN ('system_admin', 'hr_manager', 'payroll_controller')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of travelQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the TRAVEL enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }

  // Payroll feeds (4.8, migration 0059): TA-DA claims paid through the run and
  // the welfare-fund deduction, with their two system pay heads.
  const payrollFeedQueries = [
    `ALTER TABLE "travel_claims" ADD COLUMN IF NOT EXISTS "payroll_run_id" uuid REFERENCES "payroll_runs"("id") ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS "travel_claims_run_idx" ON "travel_claims" ("payroll_run_id")`,
    `INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
      SELECT md5('payhead:TADA')::uuid, 'TADA', 'Travel / TA-DA reimbursement', 'allowance', false, 'None', 'FixedAmount', 0
      WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'TADA')`,
    `INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
      SELECT md5('payhead:WELFARE_FUND')::uuid, 'WELFARE_FUND', 'Welfare fund contribution', 'deduction', false, 'None', 'FixedAmount', 0
      WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'WELFARE_FUND')`,
  ];
  for (const q of payrollFeedQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until travel_claims / pay_heads exist.
    }
  }

  // Employee dossier (4.2c, migration 0060): qualifications, past employment,
  // attachments; files they own are marked attached_to.
  const dossierQueries = [
    `ALTER TABLE "employee_document_files" ADD COLUMN IF NOT EXISTS "attached_to" varchar(20)`,
    `CREATE TABLE IF NOT EXISTS "employee_qualifications" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "level" varchar(12) NOT NULL,
        "degree" varchar(120) NOT NULL,
        "institution" varchar(200) DEFAULT '' NOT NULL,
        "board" varchar(200) DEFAULT '' NOT NULL,
        "passed_year" varchar(10) DEFAULT '' NOT NULL,
        "division" varchar(40) DEFAULT '' NOT NULL,
        "major" varchar(120) DEFAULT '' NOT NULL,
        "file_id" uuid REFERENCES "employee_document_files"("id") ON DELETE SET NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS "employee_work_history" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "organisation" varchar(200) NOT NULL,
        "designation" varchar(120) NOT NULL,
        "from_ad" date NOT NULL,
        "to_ad" date,
        "duties" text,
        "reference" varchar(200) DEFAULT '' NOT NULL,
        "file_id" uuid REFERENCES "employee_document_files"("id") ON DELETE SET NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS "employee_attachments" (
        "id" uuid PRIMARY KEY NOT NULL,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "kind" varchar(20) NOT NULL,
        "title" varchar(150) NOT NULL,
        "note" text,
        "file_id" uuid NOT NULL REFERENCES "employee_document_files"("id") ON DELETE CASCADE,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
    `CREATE INDEX IF NOT EXISTS "employee_qualifications_employee_idx" ON "employee_qualifications" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "employee_work_history_employee_idx" ON "employee_work_history" ("employee_id")`,
    `CREATE INDEX IF NOT EXISTS "employee_attachments_employee_idx" ON "employee_attachments" ("employee_id")`,
  ];
  for (const q of dossierQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until employees / employee_document_files exist.
    }
  }

  // Welfare funds (G9, migration 0054): fund types and the append-only fund ledger,
  // plus the WELFARE_FUNDS permission module (the 0047 pattern).
  const fundQueries = [
    `CREATE TABLE IF NOT EXISTS "fund_types" (
      "id" uuid PRIMARY KEY NOT NULL,
      "code" varchar(30) NOT NULL,
      "name" varchar(100) NOT NULL,
      "name_np" varchar(100) DEFAULT '' NOT NULL,
      "contribution_mode" varchar(15) DEFAULT 'fixed' NOT NULL,
      "employee_value" numeric(15,2) DEFAULT 0 NOT NULL,
      "employer_value" numeric(15,2) DEFAULT 0 NOT NULL,
      "note" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "fund_types_code_unique" UNIQUE ("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "fund_ledger" (
      "id" uuid PRIMARY KEY NOT NULL,
      "fund_type_id" uuid NOT NULL REFERENCES "fund_types"("id") ON DELETE RESTRICT,
      "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
      "kind" varchar(12) NOT NULL,
      "employee_amount" numeric(15,2) DEFAULT 0 NOT NULL,
      "employer_amount" numeric(15,2) DEFAULT 0 NOT NULL,
      "ref" varchar(80) NOT NULL,
      "note" text,
      "posted_by" uuid,
      "posted_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "fund_ledger_ref_key" UNIQUE ("fund_type_id", "employee_id", "ref")
    )`,
    `CREATE INDEX IF NOT EXISTS "fund_ledger_employee_idx" ON "fund_ledger" ("employee_id", "fund_type_id")`,
    `INSERT INTO "permissions" ("id", "action", "module")
      SELECT md5('perm:' || a || ':WELFARE_FUNDS')::uuid, a::action, 'WELFARE_FUNDS'::module
      FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
      ON CONFLICT ("action", "module") DO NOTHING`,
    `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
      FROM "roles" r
      JOIN "permissions" p ON p."module" = 'WELFARE_FUNDS'
        AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
      WHERE r."slug" IN ('system_admin', 'hr_manager', 'payroll_controller')
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )`,
  ];
  for (const q of fundQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored until the referenced tables exist, or until the WELFARE_FUNDS enum
      // value from step 1 is committed (the next sync pass completes it).
    }
  }
}
