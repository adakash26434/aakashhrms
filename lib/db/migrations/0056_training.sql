-- G7: training. training_programs is one row per programme (planned → running → completed or
-- cancelled, optional service bond in months); training_participants nominates staff and records
-- attended / absent / completed with score and certificate number. Adds the TRAINING permission module
-- (System Administrator all; HR Manager VIEW/ADD/EDIT). Idempotent; PG10-safe ids (md5).
-- ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'TRAINING';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_programs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" varchar(200) NOT NULL,
  "provider" varchar(200) DEFAULT '' NOT NULL,
  "kind" varchar(12) NOT NULL,
  "start_ad" date NOT NULL,
  "end_ad" date NOT NULL,
  "hours" numeric(7,2) NOT NULL,
  "cost" numeric(15,2) DEFAULT 0 NOT NULL,
  "bond_months" integer DEFAULT 0 NOT NULL,
  "note" text,
  "status" varchar(10) DEFAULT 'planned' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_participants" (
  "id" uuid PRIMARY KEY NOT NULL,
  "program_id" uuid NOT NULL REFERENCES "training_programs"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "status" varchar(10) DEFAULT 'nominated' NOT NULL,
  "score" numeric(5,2),
  "certificate_no" varchar(60),
  "marked_by" uuid,
  "marked_at" timestamp,
  "nominated_by" uuid,
  "nominated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "training_participants_key" UNIQUE ("program_id", "employee_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_programs_status_idx" ON "training_programs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_participants_employee_idx" ON "training_participants" ("employee_id");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':TRAINING')::uuid, a::action, 'TRAINING'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'TRAINING'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
