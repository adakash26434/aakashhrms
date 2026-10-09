-- G8: disciplinary & grievance cases. hr_cases is one row per matter (open → investigating →
-- decided → closed); hr_case_events is its append-only timeline. Adds the DISCIPLINE permission
-- module (System Administrator all; HR Manager VIEW/ADD/EDIT/APPROVE). Idempotent; PG10-safe ids
-- (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'DISCIPLINE';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr_cases" (
  "id" uuid PRIMARY KEY NOT NULL,
  "category" varchar(15) NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "severity" varchar(10) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "status" varchar(15) DEFAULT 'open' NOT NULL,
  "outcome" varchar(30),
  "outcome_note" text,
  "decided_by" uuid,
  "decided_at" timestamp,
  "opened_by" uuid NOT NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "closed_by" uuid,
  "closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr_case_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "hr_cases"("id") ON DELETE CASCADE,
  "kind" varchar(12) NOT NULL,
  "text" text NOT NULL,
  "actor_id" uuid,
  "at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_cases_employee_idx" ON "hr_cases" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_cases_status_idx" ON "hr_cases" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_case_events_case_idx" ON "hr_case_events" ("case_id", "at");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':DISCIPLINE')::uuid, a::action, 'DISCIPLINE'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'DISCIPLINE'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
