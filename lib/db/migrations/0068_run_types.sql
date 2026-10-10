-- 4.8 / F6: pay run types. REGULAR is the monthly salary; FESTIVAL and ARREARS are off-cycle runs
-- in the same pay month that pay one thing on its own (taxed with the marginal method). One run of
-- each type per pay month and branch. Existing runs are REGULAR. Idempotent.
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "run_type" varchar(20) DEFAULT 'REGULAR' NOT NULL;
CREATE INDEX IF NOT EXISTS "payroll_runs_period_type_idx" ON "payroll_runs" ("pay_period_year", "pay_period_month", "run_type");
