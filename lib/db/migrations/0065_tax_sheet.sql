-- 4.8 / F5: payroll_slips.tax_sheet keeps the tax computation (YTD taxable income and TDS,
-- projected annual taxable, annual tax, tax still to collect, months remaining) that produced the
-- slip's TDS, so the payslip detail and the employee can show how it was worked out. Idempotent.
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "tax_sheet" jsonb;
