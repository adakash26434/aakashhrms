ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "is_head_office" boolean DEFAULT false NOT NULL;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "remote_category" varchar(20) DEFAULT 'NONE' NOT NULL;

CREATE TABLE IF NOT EXISTS "shreni_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(50) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "level_number" integer NOT NULL,
  "label_nepali" varchar(255) NOT NULL,
  "description" text,
  "min_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
  "max_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
  "rank_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "shreni_levels_level_number_idx" ON "shreni_levels" ("level_number");
CREATE INDEX IF NOT EXISTS "shreni_levels_is_active_idx" ON "shreni_levels" ("is_active");

CREATE TABLE IF NOT EXISTS "employment_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(50) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "is_pf_eligible" boolean DEFAULT true NOT NULL,
  "is_ssf_eligible" boolean DEFAULT true NOT NULL,
  "is_festival_eligible" boolean DEFAULT true NOT NULL,
  "is_leave_eligible" boolean DEFAULT true NOT NULL,
  "is_ot_eligible" boolean DEFAULT true NOT NULL,
  "notice_period_days" integer DEFAULT 30 NOT NULL,
  "probation_months" integer DEFAULT 6 NOT NULL,
  "rank_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "employment_types_is_active_idx" ON "employment_types" ("is_active");
