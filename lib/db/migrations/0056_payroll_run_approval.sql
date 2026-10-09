-- 4.8a Payroll run: the approval flow copied onto a run when it is submitted (the 4.4 pattern:
-- approval_type / approval_levels / current_level / approval_route), who submitted it, the
-- variance review (each employee's flags against the last locked run and the acknowledgement),
-- and the run type (REGULAR; bonus / arrears / settlement runs come with 4.8b). Payslips keep the
-- month's welfare fund contributions (employee share deducted, the detail for the payslip line).
-- Additive only, idempotent, PostgreSQL 10 safe.
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "run_type" varchar(20) DEFAULT 'REGULAR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "approval_type" varchar(20);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "current_level" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "approval_route" varchar(20);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "variance" jsonb;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "submitted_by" uuid;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "fund_deduction" numeric(15, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "fund_detail" jsonb;
