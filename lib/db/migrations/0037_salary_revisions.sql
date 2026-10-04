-- 4.4 Salary structure: revisions with status and batch, change batches, salary templates.
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_salary_map_batch_id_idx" ON "employee_salary_map" ("batch_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_change_batches" (
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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "salary_change_batches_status_idx" ON "salary_change_batches" ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_templates" (
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
);
