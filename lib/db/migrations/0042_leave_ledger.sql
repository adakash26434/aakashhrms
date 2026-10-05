-- 4.6a Leaves: leave types say how they count and pay (kind, day basis, paid days per
-- event, half days, Labour Act §51 rights, accrual / expiry), public holidays stop being a
-- leave type, substitute and unpaid leave are added, requests keep their counted days, pay
-- split and approval flow, and every balance change goes to an immutable ledger (existing
-- balances become opening / taken lines once). Idempotent.
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "kind" varchar(10);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "day_basis" varchar(10);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "paid_days_per_event" numeric(5, 1);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_per_request" numeric(5, 1);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "allow_half_day" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_right" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "accrual_every_days" integer;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "expiry_days" integer;
--> statement-breakpoint
UPDATE "leave_types" SET
  "kind" = CASE
    WHEN coalesce("statutory_code", "code") IN ('HOME', 'SICK', 'SUBSTITUTE') THEN 'balance'
    WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN 'event'
    WHEN coalesce("statutory_code", "code") = 'PUBLIC' THEN 'none'
    WHEN "leave_type" = 'Non-Pay' THEN 'none'
    ELSE 'balance' END,
  "day_basis" = CASE WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN 'calendar' ELSE 'working' END,
  "paid_days_per_event" = CASE WHEN coalesce("statutory_code", "code") = 'MATERNITY' THEN coalesce("max_paid_days", 60) ELSE NULL END,
  "allow_half_day" = CASE WHEN coalesce("statutory_code", "code") IN ('MATERNITY', 'PATERNITY', 'MOURNING') THEN false ELSE true END,
  "is_right" = coalesce("statutory_code", "code") IN ('SICK', 'MATERNITY', 'PATERNITY', 'MOURNING'),
  "accrual_every_days" = CASE WHEN coalesce("statutory_code", "code") = 'HOME' THEN 20 ELSE NULL END,
  "expiry_days" = CASE WHEN coalesce("statutory_code", "code") = 'SUBSTITUTE' THEN 21 ELSE NULL END,
  "is_active" = CASE WHEN coalesce("statutory_code", "code") = 'PUBLIC' THEN false ELSE "is_active" END
WHERE "kind" IS NULL;
--> statement-breakpoint
INSERT INTO "leave_types" ("id", "name", "code", "leave_type", "no_of_days", "carry_forward", "is_statutory", "statutory_code", "gender_applicable", "is_encashable", "pro_rata_for_new_joinees", "is_platform_locked", "platform_code", "is_active", "kind", "day_basis", "allow_half_day", "is_right", "expiry_days", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Substitute Leave', 'SUBSTITUTE', 'Pay', 0, false, true, 'SUBSTITUTE', 'All', false, false, true, 'SUBSTITUTE', true, 'balance', 'working', true, false, 21, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "leave_types" WHERE "code" = 'SUBSTITUTE' OR "statutory_code" = 'SUBSTITUTE');
--> statement-breakpoint
INSERT INTO "leave_types" ("id", "name", "code", "leave_type", "no_of_days", "carry_forward", "is_statutory", "gender_applicable", "is_encashable", "pro_rata_for_new_joinees", "is_platform_locked", "is_active", "kind", "day_basis", "allow_half_day", "is_right", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Unpaid Leave', 'UNPAID', 'Non-Pay', 0, false, false, 'All', false, false, false, true, 'none', 'working', true, false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "leave_types" WHERE "code" = 'UNPAID');
--> statement-breakpoint
-- English-only screens for now: drop the Nepali in brackets from the seeded statutory names.
UPDATE "leave_types" SET "name" = btrim(regexp_replace("name", ' *[(][ऀ-ॿ /]+[)]', '', 'g')), "updated_at" = now()
WHERE "statutory_code" IS NOT NULL AND "name" ~ '[ऀ-ॿ]';
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "half" varchar(6);
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "days_detail" jsonb;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "paid_days" numeric(6, 2);
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "unpaid_days" numeric(6, 2);
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'hr' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "prepared_by" uuid;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_type" varchar(20);
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "current_level" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "approval_route" varchar(20);
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "certificate_note" text;
--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN IF NOT EXISTS "ssf_claim" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_ledger" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
  "fiscal_year_id" uuid NOT NULL REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "entry_date" date NOT NULL,
  "kind" varchar(20) NOT NULL,
  "days" numeric(6, 2) NOT NULL,
  "application_id" uuid,
  "note" text,
  "expires_on" date,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_ledger_emp_type_year_idx" ON "leave_ledger" ("employee_id", "leave_type_id", "fiscal_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_ledger_application_idx" ON "leave_ledger" ("application_id");
--> statement-breakpoint
INSERT INTO "leave_ledger" ("id", "employee_id", "leave_type_id", "fiscal_year_id", "entry_date", "kind", "days", "note", "created_at")
SELECT gen_random_uuid(), b."employee_id", b."leave_type_id", b."fiscal_year_id", (fy."start_date_ad" + interval '12 hours')::date, 'opening', b."allotted" + b."carried_forward", 'Balance before 4.6', now()
FROM "employee_leave_balances" b
JOIN "leave_types" t ON t."id" = b."leave_type_id" AND t."kind" = 'balance'
JOIN "fiscal_years" fy ON fy."id" = b."fiscal_year_id"
WHERE NOT EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."employee_id" = b."employee_id" AND l."leave_type_id" = b."leave_type_id" AND l."fiscal_year_id" = b."fiscal_year_id");
--> statement-breakpoint
INSERT INTO "leave_ledger" ("id", "employee_id", "leave_type_id", "fiscal_year_id", "entry_date", "kind", "days", "note", "created_at")
SELECT gen_random_uuid(), b."employee_id", b."leave_type_id", b."fiscal_year_id", (fy."start_date_ad" + interval '12 hours')::date, 'taken', -b."taken", 'Taken before 4.6', now()
FROM "employee_leave_balances" b
JOIN "leave_types" t ON t."id" = b."leave_type_id" AND t."kind" = 'balance'
JOIN "fiscal_years" fy ON fy."id" = b."fiscal_year_id"
WHERE b."taken" > 0
  AND NOT EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."employee_id" = b."employee_id" AND l."leave_type_id" = b."leave_type_id" AND l."fiscal_year_id" = b."fiscal_year_id" AND l."kind" = 'taken' AND l."note" = 'Taken before 4.6');
