-- 4.8 / F1-F3: payroll controls. payroll_runs.published_at / published_by: employees see a run's payslips
-- only after it is locked and published (before this, any slip in any status was visible in the portal).
-- Runs that were already locked are published once, here, so staff keep their past payslips.
-- payroll_slips.held_at / held_by / hold_reason: hold one payslip back from the employee.
-- payroll_variance_acks: acknowledgements of variance flags (F1), one per run and flag. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_runs' AND column_name = 'published_at') THEN
    ALTER TABLE "payroll_runs" ADD COLUMN "published_at" timestamp;
    ALTER TABLE "payroll_runs" ADD COLUMN "published_by" uuid;
    UPDATE "payroll_runs" SET "published_at" = COALESCE("locked_at", now()) WHERE "status" = 'LOCKED';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "held_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "held_by" uuid;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "hold_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_variance_acks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  "flag_key" varchar(100) NOT NULL,
  "employee_id" uuid NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "acked_by" uuid NOT NULL,
  "acked_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_variance_acks_key" UNIQUE ("payroll_run_id", "flag_key")
);
