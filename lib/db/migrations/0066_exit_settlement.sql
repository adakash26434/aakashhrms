-- 4.8 / F8: the full & final settlement of an exit case. One row per case; the statement lines and
-- totals are frozen when it is prepared (a draft can be prepared again; approved / paid never change).
-- Idempotent.
CREATE TABLE IF NOT EXISTS "exit_settlements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "exit_case_id" uuid NOT NULL REFERENCES "exit_cases"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "status" varchar(10) DEFAULT 'draft' NOT NULL,
  "lines" jsonb NOT NULL,
  "earnings" numeric(15,2) NOT NULL,
  "deductions" numeric(15,2) NOT NULL,
  "net" numeric(15,2) NOT NULL,
  "tax_sheet" jsonb,
  "policy" jsonb NOT NULL,
  "prepared_by" uuid NOT NULL,
  "prepared_at" timestamp DEFAULT now() NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp,
  "paid_by" uuid,
  "paid_at" timestamp,
  "payment_ref" varchar(100),
  CONSTRAINT "exit_settlements_case_key" UNIQUE ("exit_case_id")
);
CREATE INDEX IF NOT EXISTS "exit_settlements_employee_idx" ON "exit_settlements" ("employee_id");
