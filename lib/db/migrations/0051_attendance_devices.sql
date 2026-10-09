-- G3: attendance devices (the 4.5 "Devices later" step). ZKTeco-class terminals push ATTLOG
-- lines to /api/devices/iclock/cdata identified by serial number; matched punches land in
-- attendance_punches (source 'device') which the 4.5 day engine already reads; unknown PINs
-- wait in device_unmatched_punches until HR maps them (device_users: PIN ↔ employee per
-- device). Idempotent.
CREATE TABLE IF NOT EXISTS "attendance_devices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "serial_no" varchar(60) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "tz_offset_minutes" integer DEFAULT 345 NOT NULL,
  "last_seen_at" timestamp,
  "last_punch_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "attendance_devices_serial_no_unique" UNIQUE ("serial_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "attendance_devices"("id") ON DELETE CASCADE,
  "device_user_id" varchar(30) NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "device_users_device_pin_key" UNIQUE ("device_id", "device_user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_users_employee_id_idx" ON "device_users" ("employee_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_unmatched_punches" (
  "id" uuid PRIMARY KEY NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "attendance_devices"("id") ON DELETE CASCADE,
  "device_user_id" varchar(30) NOT NULL,
  "punched_at" timestamptz NOT NULL,
  "raw" varchar(200) DEFAULT '' NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "device_unmatched_punches_key" UNIQUE ("device_id", "device_user_id", "punched_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_unmatched_punches_device_idx" ON "device_unmatched_punches" ("device_id", "received_at");
