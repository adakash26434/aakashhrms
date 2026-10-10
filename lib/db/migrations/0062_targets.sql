-- G15: targets and achievements. employee_targets is one metric for one employee and period (fiscal
-- month or year) with the employee's reported achievement, the supervisor's verified value and the
-- status (set → submitted → forwarded → closed, with returned loops). target_attachments holds the
-- evidence the employee uploads (target_id null = staged, not saved yet; cleaned up after a day).
-- Adds the TARGETS permission module (System Administrator all; HR Manager VIEW/ADD/EDIT/APPROVE).
-- Idempotent; PG10-safe ids (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'TARGETS';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_targets" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "target_attachments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "target_id" uuid REFERENCES "employee_targets"("id") ON DELETE CASCADE,
  "file_name" varchar(200) NOT NULL,
  "mime" varchar(40) NOT NULL,
  "size" integer NOT NULL,
  "content" bytea NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_targets_employee_period_idx" ON "employee_targets" ("employee_id", "fy", "period_kind", "month_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_targets_status_idx" ON "employee_targets" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "target_attachments_target_idx" ON "target_attachments" ("target_id");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':TARGETS')::uuid, a::action, 'TARGETS'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'TARGETS'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
