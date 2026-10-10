-- 4.10 Loans: requests approved by someone else, disbursement, exact recovery through payroll,
-- opening balances.
--   * loan_types: kind (loan | advance — a salary advance carries no interest and is recovered within
--     12 months), limits (a fixed amount and / or months of basic + grade), months of service before
--     someone may ask, and whether employees request it themselves (self-service).
--   * loan_requests: what is asked (employee, type, amount, installments, reason, the type's rate
--     frozen) and the approval flow fixed when it was made (the approval engine: none / simple /
--     multi-level, Final approve; the timeline is in approval_actions, module LOANS). Approved
--     requests are disbursed into a loan (loan_id). At most one open request per employee and type.
--     S21: nobody approves or disburses their own.
--   * loans: where each came from (disbursed here | opening = carried from the old system), the
--     terms frozen at disbursement (rate, total payable), the BS month payroll starts deducting,
--     how it was paid out and how it closed (repaid | settlement | written_off).
--   * payroll_slip_loans: what each payslip deducts for each loan, written with the payslip and
--     posted to the loan (claim-first) when the run is locked. The salary structure's loan amounts
--     are no longer read: payroll deducts a loan only when a loan is recorded.
-- Idempotent.
ALTER TABLE "loan_types" ADD COLUMN IF NOT EXISTS "kind" varchar(20) DEFAULT 'loan' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loan_types" ADD COLUMN IF NOT EXISTS "name_np" varchar(255);
--> statement-breakpoint
ALTER TABLE "loan_types" ADD COLUMN IF NOT EXISTS "max_salary_months" numeric(5,2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loan_types" ADD COLUMN IF NOT EXISTS "eligible_after_months" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "loan_types" ADD COLUMN IF NOT EXISTS "self_service" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'disbursed' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "interest_rate" numeric(5,2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "total_payable" numeric(15,2);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "first_deduction_month" varchar(7);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "paid_via" varchar(20);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "payment_ref" varchar(100);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "note" varchar(500);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "closed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "closed_how" varchar(20);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "closed_by" uuid;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "close_note" varchar(500);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "written_off_amount" numeric(15,2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
-- Loans given before 4.10: what they recover is what came back plus what is left; the flat rate
-- they were given at follows from it.
UPDATE "loans" SET "total_payable" = "total_returned" + "remaining_amount" WHERE "total_payable" IS NULL;
--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "total_payable" SET NOT NULL;
--> statement-breakpoint
UPDATE "loans" SET "interest_rate" = LEAST(999.99, ROUND(("total_payable" / "loan_amount" - 1) * 100, 2)) WHERE "interest_rate" = 0 AND "loan_amount" > 0 AND "total_payable" > "loan_amount";
--> statement-breakpoint
UPDATE "loans" SET "closed_at" = "updated_at", "closed_how" = 'repaid' WHERE "status" = 'CLOSED' AND "closed_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_status_idx" ON "loans" ("status");
--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD COLUMN IF NOT EXISTS "note" varchar(500);
--> statement-breakpoint
-- A payslip posts each loan once (older data with duplicates keeps working without the index).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "loan_repayments" WHERE "payroll_slip_id" IS NOT NULL GROUP BY "payroll_slip_id", "loan_id" HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "loan_repayments_slip_loan_key" ON "loan_repayments" ("payroll_slip_id", "loan_id") WHERE "payroll_slip_id" IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loan_requests" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "loan_type_id" uuid NOT NULL REFERENCES "loan_types"("id") ON DELETE RESTRICT,
  "amount" numeric(15,2) NOT NULL,
  "installments" integer NOT NULL,
  "interest_rate" numeric(5,2) DEFAULT '0' NOT NULL,
  "reason" varchar(500) NOT NULL,
  "source" varchar(20) DEFAULT 'office' NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "prepared_by" uuid,
  "approval_type" varchar(20),
  "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_level" integer DEFAULT 0 NOT NULL,
  "approval_route" varchar(20),
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" varchar(500),
  "loan_id" uuid REFERENCES "loans"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_requests_employee_idx" ON "loan_requests" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_requests_status_idx" ON "loan_requests" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loan_requests_one_open_key" ON "loan_requests" ("employee_id", "loan_type_id") WHERE "status" IN ('pending', 'approved');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loan_requests_loan_key" ON "loan_requests" ("loan_id") WHERE "loan_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_slip_loans" (
  "id" uuid PRIMARY KEY NOT NULL,
  "payroll_slip_id" uuid NOT NULL REFERENCES "payroll_slips"("id") ON DELETE CASCADE,
  "loan_id" uuid NOT NULL REFERENCES "loans"("id") ON DELETE RESTRICT,
  "amount" numeric(15,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_slip_loans_slip_loan_key" UNIQUE ("payroll_slip_id", "loan_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_slip_loans_loan_idx" ON "payroll_slip_loans" ("loan_id");
