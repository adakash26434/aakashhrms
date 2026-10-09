-- G5: exit workflow. Resignation / retirement / termination / contract end / death as a case
-- with notice and last working day, a per-unit clearance checklist (accounts, IT/admin,
-- branch, HR) and a Complete step that marks the employee Inactive and writes the
-- employee_termination mirror in one transaction. Settlement maths stays with payroll (F8).
-- Idempotent.
CREATE TABLE IF NOT EXISTS "exit_cases" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "kind" varchar(20) NOT NULL,
  "notice_date" date,
  "last_working_day_ad" date NOT NULL,
  "last_working_day_bs" varchar(20) NOT NULL,
  "reason" text,
  "status" varchar(10) DEFAULT 'open' NOT NULL,
  "letter_id" uuid REFERENCES "hr_letters"("id") ON DELETE SET NULL,
  "opened_by" uuid NOT NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "closed_by" uuid,
  "closed_at" timestamp,
  "cancelled_by" uuid,
  "cancelled_at" timestamp,
  "cancel_reason" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exit_cases_employee_id_idx" ON "exit_cases" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exit_cases_status_idx" ON "exit_cases" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exit_clearances" (
  "id" uuid PRIMARY KEY NOT NULL,
  "exit_case_id" uuid NOT NULL REFERENCES "exit_cases"("id") ON DELETE CASCADE,
  "unit" varchar(20) NOT NULL,
  "status" varchar(10) DEFAULT 'pending' NOT NULL,
  "note" text,
  "decided_by" uuid,
  "decided_at" timestamp,
  CONSTRAINT "exit_clearances_case_unit_key" UNIQUE ("exit_case_id", "unit")
);
