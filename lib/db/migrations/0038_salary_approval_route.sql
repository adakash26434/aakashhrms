-- 4.4 follow-up: Zoho-style approvals. Each salary change batch keeps the flow it was
-- submitted with (type, levels, the level waiting) and how it was approved; every step
-- goes to approval_actions (the timeline). Idempotent: safe to run more than once.
ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_route" varchar(20);--> statement-breakpoint
ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_type" varchar(20);--> statement-breakpoint
ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "salary_change_batches" ADD COLUMN IF NOT EXISTS "current_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_actions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "module" varchar(40) NOT NULL,
  "request_id" uuid NOT NULL,
  "level" integer DEFAULT 0 NOT NULL,
  "actor_id" uuid,
  "on_behalf_of" uuid,
  "action" varchar(20) NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_actions_request_idx" ON "approval_actions" ("module", "request_id");--> statement-breakpoint
UPDATE "salary_change_batches" SET "approval_route" = 'simple' WHERE "approval_route" = 'second_person';--> statement-breakpoint
UPDATE "salary_change_batches" SET "approval_route" = 'final_approve' WHERE "approval_route" = 'administrator';--> statement-breakpoint
UPDATE "salary_change_batches" SET "approval_route" = CASE
  WHEN "kind" = 'hire' THEN 'on_hire'
  WHEN "kind" = 'policy' THEN 'policy'
  WHEN "decided_by" IS NOT DISTINCT FROM "prepared_by" THEN 'not_required'
  ELSE 'simple' END
WHERE "status" = 'approved' AND "approval_route" IS NULL;--> statement-breakpoint
UPDATE "salary_change_batches" SET "approval_type" = CASE WHEN "kind" IN ('hire', 'policy') OR "approval_route" = 'not_required' THEN 'none' ELSE 'simple' END
WHERE "approval_type" IS NULL;--> statement-breakpoint
INSERT INTO "approval_actions" ("id", "module", "request_id", "level", "actor_id", "action", "created_at")
SELECT md5("id"::text || ':submitted')::uuid, 'SALARY_MAPPING', "id", 0, "prepared_by", 'submitted', "created_at" FROM "salary_change_batches"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "approval_actions" ("id", "module", "request_id", "level", "actor_id", "action", "note", "created_at")
SELECT md5("id"::text || ':decided')::uuid, 'SALARY_MAPPING', "id", 0, "decided_by",
  CASE "status" WHEN 'approved' THEN (CASE "approval_route" WHEN 'final_approve' THEN 'final_approved' WHEN 'simple' THEN 'approved' WHEN 'levels' THEN 'approved' ELSE 'not_required' END) ELSE "status" END,
  "decision_note", COALESCE("decided_at", "created_at")
FROM "salary_change_batches" WHERE "status" <> 'pending'
ON CONFLICT ("id") DO NOTHING;
