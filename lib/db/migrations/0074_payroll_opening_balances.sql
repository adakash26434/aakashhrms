-- 4.8 / F15: opening balances for a company that starts payroll here mid-year. One row per
-- employee and fiscal year: what the old system paid in the first `months` fiscal months
-- (Shrawan = 1) — gross earnings, PF / SSF and CIT deducted, taxable income, social security
-- tax and income tax deducted. The tax projection, the Ashadh reconciliation and the annual
-- tax certificate count it as those months; no payroll run here may pay a month it covers.
-- Idempotent.
CREATE TABLE IF NOT EXISTS "payroll_opening_balances" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE CASCADE,
  "months" integer NOT NULL CHECK ("months" BETWEEN 1 AND 11),
  "gross_earnings" numeric(15, 2) DEFAULT 0 NOT NULL,
  "retirement" numeric(15, 2) DEFAULT 0 NOT NULL,
  "cit" numeric(15, 2) DEFAULT 0 NOT NULL,
  "taxable_income" numeric(15, 2) DEFAULT 0 NOT NULL,
  "sst" numeric(15, 2) DEFAULT 0 NOT NULL,
  "income_tax" numeric(15, 2) DEFAULT 0 NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_opening_balances_employee_year_key" UNIQUE ("employee_id", "fiscal_year_id")
);
CREATE INDEX IF NOT EXISTS "payroll_opening_balances_year_idx" ON "payroll_opening_balances" ("fiscal_year_id");
