-- G14: assets and notice board. assets is the register; asset_handovers records who holds
-- what (at most one open handover per asset, enforced in code); notices is the board.
-- Adds the ASSETS and NOTICE_BOARD permission modules (System Administrator all; HR Manager
-- VIEW/ADD/EDIT on assets, VIEW/ADD/EDIT/DELETE on notices). Idempotent; PG10-safe ids (md5).
-- ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'ASSETS';
--> statement-breakpoint
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'NOTICE_BOARD';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tag" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "category" varchar(30) NOT NULL,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "note" text,
  "status" varchar(12) DEFAULT 'available' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "assets_tag_key" UNIQUE ("tag")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_handovers" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "issued_ad" date NOT NULL,
  "returned_ad" date,
  "condition" varchar(12),
  "note" text,
  "issued_by" uuid,
  "returned_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE CASCADE,
  "publish_ad" date NOT NULL,
  "expires_ad" date,
  "pinned" boolean DEFAULT false NOT NULL,
  "status" varchar(10) DEFAULT 'published' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_employee_idx" ON "asset_handovers" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_asset_idx" ON "asset_handovers" ("asset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_publish_idx" ON "notices" ("status", "publish_ad");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':ASSETS')::uuid, a::action, 'ASSETS'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'ASSETS'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':NOTICE_BOARD')::uuid, a::action, 'NOTICE_BOARD'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'NOTICE_BOARD'
  AND (r."slug" = 'system_admin' OR p."action" IN ('VIEW', 'ADD', 'EDIT', 'DELETE'))
WHERE r."slug" IN ('system_admin', 'hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
