-- G9: welfare / medical / gratuity funds. fund_types holds the contribution rule (fixed per
-- month or percent of basic, employee + employer shares); fund_ledger is APPEND-ONLY like
-- leave_ledger (never update or delete; mistakes are corrected by adjustment lines; `ref` is
-- unique per employee+fund so contributions never post twice). Adds the WELFARE_FUNDS
-- permission module (System Administrator all; HR Manager and Payroll Controller
-- VIEW/ADD/EDIT). Idempotent; PG10-safe ids (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'WELFARE_FUNDS';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fund_types" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_np" varchar(100) DEFAULT '' NOT NULL,
  "contribution_mode" varchar(15) DEFAULT 'fixed' NOT NULL,
  "employee_value" numeric(15,2) DEFAULT 0 NOT NULL,
  "employer_value" numeric(15,2) DEFAULT 0 NOT NULL,
  "note" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "fund_types_code_unique" UNIQUE ("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fund_ledger" (
  "id" uuid PRIMARY KEY NOT NULL,
  "fund_type_id" uuid NOT NULL REFERENCES "fund_types"("id") ON DELETE RESTRICT,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "kind" varchar(12) NOT NULL,
  "employee_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "employer_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "ref" varchar(80) NOT NULL,
  "note" text,
  "posted_by" uuid,
  "posted_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "fund_ledger_ref_key" UNIQUE ("fund_type_id", "employee_id", "ref")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_ledger_employee_idx" ON "fund_ledger" ("employee_id", "fund_type_id");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':WELFARE_FUNDS')::uuid, a::action, 'WELFARE_FUNDS'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'WELFARE_FUNDS'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
WHERE r."slug" IN ('system_admin', 'hr_manager', 'payroll_controller')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
