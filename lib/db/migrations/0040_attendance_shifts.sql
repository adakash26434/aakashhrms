-- 4.5b Shifts: shifts defined by the company (hours, a week with off days and
-- own hours per weekday, seasons by BS date range), dated assignments per
-- employee, a day-by-day roster (rotations, swaps, OFF), a default shift per
-- branch, and the shift stored on closed days. Idempotent.
CREATE TABLE IF NOT EXISTS "shifts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(10) NOT NULL,
  "name" varchar(60) NOT NULL,
  "color" varchar(12) DEFAULT 'green' NOT NULL,
  "kind" varchar(10) DEFAULT 'fixed' NOT NULL,
  "start_time" varchar(5) NOT NULL,
  "end_time" varchar(5) NOT NULL,
  "break_minutes" integer DEFAULT 30 NOT NULL,
  "grace_minutes" integer DEFAULT 15 NOT NULL,
  "full_day_minutes" integer DEFAULT 420 NOT NULL,
  "half_day_minutes" integer DEFAULT 240 NOT NULL,
  "ot_minimum_minutes" integer DEFAULT 30 NOT NULL,
  "week" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_code_idx" ON "shifts" ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_one_default_idx" ON "shifts" ("is_default") WHERE "is_default" = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "shift_id" uuid NOT NULL REFERENCES "shifts"("id") ON DELETE RESTRICT,
  "from_date" date NOT NULL,
  "to_date" date,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_assignments_emp_idx" ON "shift_assignments" ("employee_id", "from_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_roster" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "roster_date" date NOT NULL,
  "shift_id" uuid REFERENCES "shifts"("id") ON DELETE RESTRICT,
  "is_off" boolean DEFAULT false NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_roster_emp_date_idx" ON "shift_roster" ("employee_id", "roster_date");
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "default_shift_id" uuid;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "shift_id" uuid;
