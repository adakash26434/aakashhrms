-- G11: TA-DA. travel_rates is the rate card (default or per designation); travel_claims is one
-- trip per claim with the engine's amounts frozen on the row. Adds the TRAVEL permission module
-- (System Administrator all; HR Manager VIEW/ADD/EDIT/APPROVE; Payroll Controller VIEW/LOCK —
-- LOCK marks a claim settled). Idempotent; PG10-safe ids (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'TRAVEL';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_rates" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "designation_id" uuid REFERENCES "designations"("id") ON DELETE CASCADE,
  "daily_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
  "lodging_per_night" numeric(12,2) DEFAULT 0 NOT NULL,
  "km_rate" numeric(8,2) DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "travel_rates_designation_key" UNIQUE ("designation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_claims" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "purpose" varchar(300) NOT NULL,
  "from_place" varchar(120) NOT NULL,
  "to_place" varchar(120) NOT NULL,
  "start_ad" date NOT NULL,
  "end_ad" date NOT NULL,
  "mode" varchar(15) NOT NULL,
  "km" numeric(8,1) DEFAULT 0 NOT NULL,
  "nights" integer DEFAULT 0 NOT NULL,
  "fare_actual" numeric(12,2) DEFAULT 0 NOT NULL,
  "lodging_actual" numeric(12,2) DEFAULT 0 NOT NULL,
  "advance" numeric(12,2) DEFAULT 0 NOT NULL,
  "rate_name" varchar(100) DEFAULT '' NOT NULL,
  "days" integer NOT NULL,
  "daily_allowance" numeric(12,2) NOT NULL,
  "lodging" numeric(12,2) NOT NULL,
  "travel" numeric(12,2) NOT NULL,
  "gross" numeric(12,2) NOT NULL,
  "payable" numeric(12,2) NOT NULL,
  "note" text,
  "status" varchar(10) DEFAULT 'draft' NOT NULL,
  "decision_note" text,
  "decided_by" uuid,
  "decided_at" timestamp,
  "settled_at" timestamp,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "travel_claims_employee_idx" ON "travel_claims" ("employee_id", "start_ad");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "travel_claims_status_idx" ON "travel_claims" ("status");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':TRAVEL')::uuid, a::action, 'TRAVEL'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'TRAVEL'
  AND (r."slug" = 'system_admin' OR (r."slug" = 'hr_manager' AND p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE')) OR (r."slug" = 'payroll_controller' AND p."action" IN ('VIEW', 'LOCK')))
WHERE r."slug" IN ('system_admin', 'hr_manager', 'payroll_controller')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
