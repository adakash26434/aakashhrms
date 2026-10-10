-- 4.9 leave salary: leave paid out in money, through the pay run.
--   * source 'year_end': days over the limit at a leave year's opening (Labour Act §49). The opening
--     already took them off the balance (a `paid_out` ledger line, ref opening:<year>); one record pays
--     one such line (`source_line_id`, unique while not cancelled).
--   * source 'balance': days encashed from the balance in force; they leave the balance (a `paid_out`
--     line, ref leave-salary:<id>) when the record is approved, and come back if it is cancelled.
-- Prepared by one person and approved by another (never for one's own record, S21); the amount is
-- frozen when prepared (basic in force × days ÷ 30, or the leave type's fixed rate, never below
-- basic). Approved records are paid on the next regular pay run on the LEAVE_ENCASH system head
-- (taxable: the payslip's tax projection withholds the TDS) and settled with that payslip.
-- Records paid before 4.9 (by hand, outside payroll) stay as they are.
-- Idempotent; ALTER TYPE runs outside transactions (PG10).
ALTER TYPE "public"."leave_salary_run_status" ADD VALUE IF NOT EXISTS 'APPROVED';
--> statement-breakpoint
ALTER TYPE "public"."leave_salary_run_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" DROP CONSTRAINT IF EXISTS "leave_salary_runs_employee_id_leave_type_id_payment_period_unique";
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'balance' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "source_line_id" uuid;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "fiscal_year_id" uuid;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "basic_salary" numeric(15,2);
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "rate_basis" varchar(20);
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "cancelled_by" uuid;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD COLUMN IF NOT EXISTS "settled_at" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_salary_runs_source_line_key" ON "leave_salary_runs" ("source_line_id") WHERE "source_line_id" IS NOT NULL AND "cancelled_at" IS NULL;
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "name_np", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:LEAVE_ENCASH')::uuid, 'LEAVE_ENCASH', 'Leave encashment', 'बिदा साटो रकम', 'allowance', true, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'LEAVE_ENCASH');
