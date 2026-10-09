-- G4: recruitment & darbandi. approved_positions holds the board-approved post count per
-- designation and branch (occupancy = active employees on that pair); a vacancy is opened
-- against a designation and branch; applicants move applied → shortlisted → exam → interview
-- → selected (or rejected anywhere) with exam/interview marks making the merit order; a
-- selected applicant is marked hired and linked once the employee exists. Adds the
-- RECRUITMENT permission module (System Administrator all; HR Manager VIEW/ADD/EDIT/DELETE).
-- Idempotent; PG10-safe ids (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'RECRUITMENT';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approved_positions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "designation_id" uuid NOT NULL REFERENCES "designations"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "positions" integer NOT NULL,
  "decision_ref" varchar(100) DEFAULT '' NOT NULL,
  "note" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "approved_positions_key" UNIQUE ("designation_id", "branch_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vacancies" (
  "id" uuid PRIMARY KEY NOT NULL,
  "designation_id" uuid NOT NULL REFERENCES "designations"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "openings" integer DEFAULT 1 NOT NULL,
  "deadline_ad" date,
  "note" text,
  "status" varchar(10) DEFAULT 'open' NOT NULL,
  "opened_by" uuid NOT NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "closed_by" uuid,
  "closed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacancies_status_idx" ON "vacancies" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applicants" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vacancy_id" uuid NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
  "full_name" varchar(255) NOT NULL,
  "phone" varchar(50) DEFAULT '' NOT NULL,
  "email" varchar(255) DEFAULT '' NOT NULL,
  "address" varchar(255) DEFAULT '' NOT NULL,
  "education_note" text,
  "stage" varchar(15) DEFAULT 'applied' NOT NULL,
  "exam_marks" numeric(5,2),
  "interview_marks" numeric(5,2),
  "note" text,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applicants_vacancy_idx" ON "applicants" ("vacancy_id", "stage");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':RECRUITMENT')::uuid, a::action, 'RECRUITMENT'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'RECRUITMENT'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
