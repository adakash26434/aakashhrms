-- 4.6c–e Leave policies. Statutory leave can only be changed in the employees' favour,
-- each change proposed by one person and approved by another (leave_type_changes keeps
-- every version: before / after, reason, from when, the approval and when it was
-- applied; system changes too). Platform exceptions for regulated companies are copied
-- here read-only (leave_policy_exceptions; only the platform writes them). Company leave
-- types gain notice, eligibility, monthly crediting, limits and a payout rate (4.6e), the
-- last two copied once from leave_rules. Statutory types apply to everyone. Idempotent.
CREATE TABLE IF NOT EXISTS "leave_type_changes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "applies" varchar(20) DEFAULT 'approval' NOT NULL,
  "effective_from" date,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "source" varchar(20) DEFAULT 'company' NOT NULL,
  "exception_id" uuid,
  "prepared_by" uuid,
  "prepared_at" timestamp DEFAULT now() NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp,
  "decision_note" text,
  "approval_route" varchar(20),
  "approval_type" varchar(20),
  "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_level" integer DEFAULT 0 NOT NULL,
  "applied_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_type_changes_type_idx" ON "leave_type_changes" ("leave_type_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_type_changes_one_pending" ON "leave_type_changes" ("leave_type_id") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_policy_exceptions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "statutory_code" varchar(50) NOT NULL,
  "setting" varchar(40) NOT NULL,
  "value" numeric(7, 1),
  "legal_basis" text NOT NULL,
  "reference" text,
  "valid_from" date NOT NULL,
  "valid_until" date,
  "revoked_at" timestamp,
  "revoke_reason" text,
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "notice_days" integer;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "eligible_after_days" integer;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "credit_mode" varchar(10) DEFAULT 'yearly' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_per_year" numeric(5, 1);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "max_days_in_service" numeric(6, 1);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "payout_fixed_amount" numeric(15, 2);
--> statement-breakpoint
UPDATE "leave_types" SET "applicable_departments" = ARRAY[]::text[], "applicable_designations" = ARRAY[]::text[]
WHERE "is_statutory" = true AND (cardinality("applicable_departments") > 0 OR cardinality("applicable_designations") > 0);
--> statement-breakpoint
UPDATE "leave_types" t SET "eligible_after_days" = r."min_service_days_for_eligibility"
FROM "leave_rules" r
WHERE r."leave_type_id" = t."id" AND t."is_statutory" = false AND t."eligible_after_days" IS NULL AND COALESCE(r."min_service_days_for_eligibility", 0) > 0;
--> statement-breakpoint
UPDATE "leave_types" t SET "encashment_basis" = 'Fixed', "payout_fixed_amount" = r."encashment_fixed_amount"
FROM "leave_rules" r
WHERE r."leave_type_id" = t."id" AND t."is_statutory" = false AND t."payout_fixed_amount" IS NULL AND r."encashment_rate" = 'FIXED_AMOUNT';
