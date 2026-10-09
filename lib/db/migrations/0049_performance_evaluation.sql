-- G1: performance evaluation (का.स.मू.). Cycles per fiscal-year period; one evaluation per
-- employee per cycle with the form (sections → criteria → max marks, stage weights, grade
-- bands) FROZEN at start; marks per criterion per stage (supervisor → reviewer → committee);
-- weighted totals and a grade band once final. Finalized marks feed promotion scoring and
-- probation confirmation (G2). Adds the PERFORMANCE permission module with its rows, granted
-- to System Administrator (all) and HR Manager (VIEW/ADD/EDIT/APPROVE/LOCK). Idempotent;
-- PG10-safe ids (md5). ALTER TYPE runs outside transactions (tenant-schema-sync runs every
-- statement individually; this file documents the change).
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'PERFORMANCE';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_templates" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_cycles" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluations" (
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_employee_id_idx" ON "evaluations" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_stage_idx" ON "evaluations" ("status", "stage");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_scores" (
  "id" uuid PRIMARY KEY NOT NULL,
  "evaluation_id" uuid NOT NULL REFERENCES "evaluations"("id") ON DELETE CASCADE,
  "stage" varchar(20) NOT NULL,
  "criterion_id" varchar(40) NOT NULL,
  "marks" numeric(5,2) NOT NULL,
  "note" text,
  "rated_by" uuid NOT NULL,
  "rated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "evaluation_scores_cell_key" UNIQUE ("evaluation_id", "stage", "criterion_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluation_scores_evaluation_id_idx" ON "evaluation_scores" ("evaluation_id");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':PERFORMANCE')::uuid, a::action, 'PERFORMANCE'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'PERFORMANCE'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
