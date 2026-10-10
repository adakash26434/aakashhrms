-- 4.8b (b1) Pay calendar and year-to-date tax. A company pays in BS or AD months (one calendar;
-- system_config key payroll.calendar, BS when absent): each run carries its calendar, and the
-- attendance month summaries are keyed by (employee, calendar, year, month) instead of
-- (employee, fiscal year, BS month). Payslips keep how the income tax was projected (tax_detail).
-- Additive apart from the old unique constraint; idempotent; PostgreSQL 10 safe.
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "calendar" varchar(2) DEFAULT 'BS' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "tax_detail" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_runs_period_idx" ON "payroll_runs" ("calendar", "pay_period_year", "pay_period_month", "run_type", "status");
--> statement-breakpoint
-- Summaries closed before 4.5 have no period columns: fill them from the fiscal year's BS start
-- year, unless a 4.5 row already covers that month (those stay outside the period index).
UPDATE "leave_ot_calculations" c SET "calendar" = 'BS', "period_month" = c."bs_month",
  "period_year" = CASE WHEN c."bs_month" >= fy."from_month" THEN left(fy."start_date_bs", 4)::int ELSE left(fy."start_date_bs", 4)::int + 1 END
FROM "fiscal_years" fy
WHERE fy."id" = c."fiscal_year_id" AND c."period_year" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "leave_ot_calculations" o
    WHERE o."employee_id" = c."employee_id" AND o."calendar" = 'BS' AND o."period_month" = c."bs_month"
      AND o."period_year" = CASE WHEN c."bs_month" >= fy."from_month" THEN left(fy."start_date_bs", 4)::int ELSE left(fy."start_date_bs", 4)::int + 1 END
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_ot_calculations_period_idx" ON "leave_ot_calculations" ("employee_id", "calendar", "period_year", "period_month") WHERE "period_year" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" DROP CONSTRAINT IF EXISTS "leave_ot_calculations_employee_id_fiscal_year_id_bs_month_unique";
