-- 4.8 / F7: arrears. payroll_arrears records back pay paid through a run for an earlier,
-- already approved / locked month (source run): one row per (employee, source run, paying run).
-- The paying run owns the row (ON DELETE CASCADE: a deleted draft gives the arrears back).
-- ARREARS is a system pay head (taxable allowance) that carries the amount. Idempotent.
CREATE TABLE IF NOT EXISTS "payroll_arrears" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "source_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  "amount" numeric(15,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_arrears_key" UNIQUE ("employee_id", "source_run_id", "payroll_run_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_arrears_source_idx" ON "payroll_arrears" ("source_run_id", "employee_id");
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:ARREARS')::uuid, 'ARREARS', 'Arrears (back pay)', 'allowance', true, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'ARREARS');
