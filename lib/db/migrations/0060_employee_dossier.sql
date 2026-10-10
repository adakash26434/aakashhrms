-- 4.2c employee dossier: qualifications, past employment and other attachments, each able to own
-- one scan in employee_document_files (attached_to marks a file a dossier row owns; document_id
-- null + attached_to null is still "not saved yet"). Idempotent; PG10-safe.
ALTER TABLE "employee_document_files" ADD COLUMN IF NOT EXISTS "attached_to" varchar(20);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_qualifications" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "level" varchar(12) NOT NULL,
  "degree" varchar(120) NOT NULL,
  "institution" varchar(200) DEFAULT '' NOT NULL,
  "board" varchar(200) DEFAULT '' NOT NULL,
  "passed_year" varchar(10) DEFAULT '' NOT NULL,
  "division" varchar(40) DEFAULT '' NOT NULL,
  "major" varchar(120) DEFAULT '' NOT NULL,
  "file_id" uuid REFERENCES "employee_document_files"("id") ON DELETE SET NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_work_history" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "organisation" varchar(200) NOT NULL,
  "designation" varchar(120) NOT NULL,
  "from_ad" date NOT NULL,
  "to_ad" date,
  "duties" text,
  "reference" varchar(200) DEFAULT '' NOT NULL,
  "file_id" uuid REFERENCES "employee_document_files"("id") ON DELETE SET NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_attachments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "kind" varchar(20) NOT NULL,
  "title" varchar(150) NOT NULL,
  "note" text,
  "file_id" uuid NOT NULL REFERENCES "employee_document_files"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_qualifications_employee_idx" ON "employee_qualifications" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_work_history_employee_idx" ON "employee_work_history" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_attachments_employee_idx" ON "employee_attachments" ("employee_id");
