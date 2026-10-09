-- G2 (letters): HR letters issued to employees — appointment, confirmation, promotion (बढुवा),
-- transfer (सरुवा), experience / job-left (अनुभव), NOC. Letters are rendered from bilingual
-- templates at issue time and frozen; mistakes are voided (never edited or deleted), and the
-- chalani (dispatch) number — one sequence per fiscal year in letter_sequences — is never
-- reused. Adds the HR_LETTERS permission module with its rows, granted to System Administrator
-- and HR Manager (other roles through the Roles screen). Idempotent; PG10-safe ids (md5).
-- NOTE: ALTER TYPE ... ADD VALUE must run outside a transaction on PG10 (tenant-schema-sync
-- runs every statement individually; this file documents the change).
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'HR_LETTERS';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "letter_templates" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "letter_sequences" (
  "id" uuid PRIMARY KEY NOT NULL,
  "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "last_seq" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "letter_sequences_fiscal_year_key" UNIQUE ("fiscal_year_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr_letters" (
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_letters_employee_id_idx" ON "hr_letters" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_letters_issued_at_idx" ON "hr_letters" ("issued_at");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':HR_LETTERS')::uuid, a::action, 'HR_LETTERS'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'HR_LETTERS'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
