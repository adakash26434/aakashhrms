-- 4.7b Overtime approvals. One row per decided overtime day: "detected" rows are written when an
-- approver decides overtime the punches show (with the minutes detected at that moment, so a
-- later change of punches sends the day back for a decision); "manual" rows are overtime added
-- by hand (worked without punches), waiting until decided. The month summary and the payslip
-- keep how the overtime amount was worked out (hours, hourly rate, rates) in ot_detail.
-- Additive only, idempotent, PostgreSQL 10 safe.
CREATE TABLE IF NOT EXISTS "overtime_entries" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "work_date" date NOT NULL,
  "source" varchar(10) NOT NULL,
  "day_kind" varchar(5) NOT NULL,
  "detected_minutes" integer DEFAULT 0 NOT NULL,
  "requested_minutes" integer DEFAULT 0 NOT NULL,
  "approved_minutes" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "over_limit" boolean DEFAULT false NOT NULL,
  "reason" text,
  "prepared_by" uuid,
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "approval_route" varchar(20),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "overtime_entries_employee_date_source_key" UNIQUE ("employee_id", "work_date", "source")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overtime_entries_date_idx" ON "overtime_entries" ("work_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overtime_entries_status_idx" ON "overtime_entries" ("status");
--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "ot_detail" jsonb;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "ot_detail" jsonb;
