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
  ];

  for (const q of otherColumnQueries) {
    try {
      await sql.unsafe(q);
    } catch {
      // Ignored if table does not exist yet
    }
  }
}
