-- Notices can be addressed to the whole company, one branch, one department or named employees.
-- audience says which; branch_id / department_id / notice_recipients carry the target.
-- Old branch notices become audience 'branch'. Idempotent; PG10-safe.
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "audience" varchar(12) DEFAULT 'company' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "notices" SET "audience" = 'branch' WHERE "branch_id" IS NOT NULL AND "audience" = 'company';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notice_recipients" (
  "notice_id" uuid NOT NULL REFERENCES "notices"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  PRIMARY KEY ("notice_id", "employee_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notice_recipients_employee_idx" ON "notice_recipients" ("employee_id");
