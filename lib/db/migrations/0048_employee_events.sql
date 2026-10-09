-- G2 (events): employee lifecycle events — promotion (बढुवा), transfer (सरुवा) and
-- confirmation (स्थायी) recorded as dated events with before/after snapshots instead of
-- silent in-place edits. An event due today or earlier is applied to the employee row in
-- the same transaction; a future-dated one stays 'scheduled' and is applied on read once
-- due. A mistaken scheduled event is cancelled; an applied one is corrected by a new
-- event. Optionally linked to the HR letter issued for it (0047). Idempotent.
CREATE TABLE IF NOT EXISTS "employee_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "kind" varchar(20) NOT NULL,
  "effective_date_ad" date NOT NULL,
  "effective_date_bs" varchar(20) NOT NULL,
  "from_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "to_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" text,
  "status" varchar(10) DEFAULT 'applied' NOT NULL,
  "letter_id" uuid REFERENCES "hr_letters"("id") ON DELETE SET NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "applied_at" timestamp,
  "cancelled_by" uuid,
  "cancelled_at" timestamp,
  "cancel_reason" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_events_employee_id_idx" ON "employee_events" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_events_due_idx" ON "employee_events" ("status", "effective_date_ad");
