-- 4.5c Web clock-in: each branch's rule (off, anywhere, office network, office location,
-- either, both) with its networks, office point and radius; remote check-ins (outside
-- the allowed place, waiting for approval) keep their IP and location; people allowed
-- to clock in from anywhere. Idempotent.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_rule" varchar(24) DEFAULT 'off' NOT NULL;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_networks" text[] DEFAULT ARRAY[]::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "checkin_radius_m" integer DEFAULT 150 NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "ip" varchar(64);
--> statement-breakpoint
ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "accuracy_m" integer;
--> statement-breakpoint
ALTER TABLE "attendance_adjustments" ADD COLUMN IF NOT EXISTS "distance_m" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_checkin_exceptions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "from_date" date NOT NULL,
  "to_date" date,
  "reason" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_checkin_exceptions_emp_idx" ON "attendance_checkin_exceptions" ("employee_id");
