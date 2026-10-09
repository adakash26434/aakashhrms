-- 4.8b (b2) Arrears. A locked payslip never changes: when a salary revision is approved with an
-- effective date in a month already paid, or a paid month's attendance is reopened and closed
-- again, the difference is paid in an ARREARS run. Each arrears payslip keeps one row per source
-- month (what was paid, what is due now, the difference by component), so the same month is
-- never paid twice. Additive, idempotent, PostgreSQL 10 safe.
CREATE TABLE IF NOT EXISTS "arrears_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "payroll_slip_id" uuid NOT NULL REFERENCES "payroll_slips"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "kind" varchar(12) NOT NULL,
  "calendar" varchar(2) NOT NULL,
  "period_year" integer NOT NULL,
  "period_month" integer NOT NULL,
  "source_slip_id" uuid REFERENCES "payroll_slips"("id") ON DELETE SET NULL,
  "source_ref" varchar(80) NOT NULL,
  "paid" jsonb NOT NULL,
  "due" jsonb NOT NULL,
  "diff" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrears_items_employee_period_idx" ON "arrears_items" ("employee_id", "calendar", "period_year", "period_month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrears_items_slip_idx" ON "arrears_items" ("payroll_slip_id");
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "arrears_detail" jsonb;
