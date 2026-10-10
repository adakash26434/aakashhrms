-- 4.8b (b3) Final settlement. A FINAL_SETTLEMENT run settles one closed exit case: the run
-- remembers the case (one settlement per case), the payslip keeps what it settled (the month,
-- leave encashment, gratuity, fund payout, loans closed out, notice recovery). Additive,
-- idempotent, PostgreSQL 10 safe.
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "exit_case_id" uuid REFERENCES "exit_cases"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_runs_exit_case_idx" ON "payroll_runs" ("exit_case_id");
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "settlement_detail" jsonb;
