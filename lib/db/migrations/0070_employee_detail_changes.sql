-- 4.8 / F13: maker-checker on sensitive employee details (bank account, PAN, tax status,
-- disability relief). A change to an existing employee's details is a row here; it waits for a
-- second person (approval_actions, module EMPLOYEE_DETAILS, keeps the timeline) unless the
-- company switched approvals off or a company administrator saved it (Payroll controls). The
-- before / after values are the changed fields only. One waiting change per employee. Idempotent.
CREATE TABLE IF NOT EXISTS "employee_detail_changes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "prepared_by" uuid,
  "prepared_at" timestamp DEFAULT now() NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "approval_route" varchar(20),
  "applied_at" timestamp
);
CREATE INDEX IF NOT EXISTS "employee_detail_changes_employee_idx" ON "employee_detail_changes" ("employee_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_detail_changes_one_pending" ON "employee_detail_changes" ("employee_id") WHERE "status" = 'pending';
