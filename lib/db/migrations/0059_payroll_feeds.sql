-- 4.8 payroll feeds: approved TA-DA claims are paid through the run (travel_claims.payroll_run_id,
-- status settled) and the month's welfare-fund employee contributions are deducted. Two system
-- pay heads carry them: TADA (allowance, not taxable — a reimbursement) and WELFARE_FUND
-- (deduction). Idempotent; PG10-safe ids (md5).
ALTER TABLE "travel_claims" ADD COLUMN IF NOT EXISTS "payroll_run_id" uuid REFERENCES "payroll_runs"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "travel_claims_run_idx" ON "travel_claims" ("payroll_run_id");
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:TADA')::uuid, 'TADA', 'Travel / TA-DA reimbursement', 'allowance', false, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'TADA');
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:WELFARE_FUND')::uuid, 'WELFARE_FUND', 'Welfare fund contribution', 'deduction', false, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'WELFARE_FUND');
