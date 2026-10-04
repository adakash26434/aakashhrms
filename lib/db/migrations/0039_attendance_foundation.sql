-- 4.5a Attendance foundation: raw punches, daily results with HR overrides, adjustment
-- (regularization) requests, attendance months per branch (BS or AD), and the month
-- summary columns payroll reads. Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS "attendance_punches" (
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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_punches_emp_time_idx" ON "attendance_punches" ("employee_id", "punched_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_punches_unique_idx" ON "attendance_punches" ("employee_id", "punched_at", "source");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "day_type" varchar(20);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "payable" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "unpaid" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "first_in" timestamptz;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "last_out" timestamptz;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "work_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "early_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "ot_work_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "ot_off_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "rule" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_type" varchar(20);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_reason" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_by" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "override_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "migrated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ALTER COLUMN "migrated" SET DEFAULT true;--> statement-breakpoint
DELETE FROM "attendance_records" a USING "attendance_records" b
WHERE a."employee_id" = b."employee_id" AND a."attendance_date" = b."attendance_date"
  AND (a."updated_at" < b."updated_at" OR (a."updated_at" = b."updated_at" AND a."id"::text < b."id"::text));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_emp_date_uq" ON "attendance_records" ("employee_id", "attendance_date");--> statement-breakpoint
INSERT INTO "attendance_punches" ("id", "employee_id", "punched_at", "kind", "source", "note")
SELECT md5(r."id"::text || ':in')::uuid, r."employee_id",
  ((r."attendance_date"::text || ' ' || to_char(to_timestamp(upper(trim(r."in_time")), CASE WHEN upper(r."in_time") ~ '(AM|PM)' THEN 'HH12:MI AM' ELSE 'HH24:MI' END), 'HH24:MI'))::timestamp AT TIME ZONE 'Asia/Kathmandu'),
  'in', 'manual', 'Recorded before 4.5'
FROM "attendance_records" r
WHERE r."migrated" = false AND r."in_time" ~ '^\s*\d{1,2}:\d{2}\s*([AaPp][Mm])?\s*$'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "attendance_punches" ("id", "employee_id", "punched_at", "kind", "source", "note")
SELECT md5(r."id"::text || ':out')::uuid, r."employee_id",
  ((r."attendance_date"::text || ' ' || to_char(to_timestamp(upper(trim(r."out_time")), CASE WHEN upper(r."out_time") ~ '(AM|PM)' THEN 'HH12:MI AM' ELSE 'HH24:MI' END), 'HH24:MI'))::timestamp AT TIME ZONE 'Asia/Kathmandu'),
  'out', 'manual', 'Recorded before 4.5'
FROM "attendance_records" r
WHERE r."migrated" = false AND r."out_time" ~ '^\s*\d{1,2}:\d{2}\s*([AaPp][Mm])?\s*$'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "attendance_records" SET
  "override_type" = CASE "status" WHEN 'Present' THEN 'present' WHEN 'Absent' THEN 'absent' WHEN 'Half Day' THEN 'half_day' WHEN 'On Leave' THEN 'paid_leave' WHEN 'LWOP' THEN 'unpaid_leave' ELSE NULL END,
  "override_reason" = CASE WHEN "status" IN ('Present', 'Absent', 'Half Day', 'On Leave', 'LWOP') THEN 'Recorded before 4.5' ELSE NULL END,
  "override_at" = CASE WHEN "status" IN ('Present', 'Absent', 'Half Day', 'On Leave', 'LWOP') THEN "updated_at" ELSE NULL END,
  "migrated" = true
WHERE "migrated" = false;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_adjustments" (
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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_adjustments_emp_date_idx" ON "attendance_adjustments" ("employee_id", "attendance_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_adjustments_status_idx" ON "attendance_adjustments" ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_periods" (
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
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_periods_unique_idx" ON "attendance_periods" ("calendar", "period_year", "period_month", "branch_id");--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "calendar" varchar(2) DEFAULT 'BS' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "period_year" integer;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "period_month" integer;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "start_date" date;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "end_date" date;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "calendar_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "payable_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "unpaid_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "not_employed_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "summary" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_ot_calculations_period_idx" ON "leave_ot_calculations" ("employee_id", "calendar", "period_year", "period_month") WHERE "period_year" IS NOT NULL;
