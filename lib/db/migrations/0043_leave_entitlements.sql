-- 4.6b Leave entitlements: ledger lines say what they are for (ref, so a month's home
-- leave, a substitute grant or a year opening is never posted twice), and leave years are
-- opened once each (carry-over with the Labour Act caps, the excess marked to be paid out,
-- yearly credits). Years that already have ledger lines (the 4.6a backfill) count as
-- opened. Idempotent.
ALTER TABLE "leave_ledger" ADD COLUMN IF NOT EXISTS "ref" varchar(80);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_ledger_emp_ref_idx" ON "leave_ledger" ("employee_id", "ref");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_year_openings" (
  "id" uuid PRIMARY KEY NOT NULL,
  "fiscal_year_id" uuid NOT NULL UNIQUE REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "from_fiscal_year_id" uuid REFERENCES "fiscal_years"("id") ON DELETE RESTRICT,
  "people" integer DEFAULT 0 NOT NULL,
  "note" text,
  "opened_by" uuid,
  "opened_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "leave_year_openings" ("id", "fiscal_year_id", "people", "note", "opened_at")
SELECT gen_random_uuid(), fy."id", (SELECT count(DISTINCT l."employee_id") FROM "leave_ledger" l WHERE l."fiscal_year_id" = fy."id"), 'Opened by 4.6', now()
FROM "fiscal_years" fy
WHERE fy."start_date_ad" <= now()
  AND EXISTS (SELECT 1 FROM "leave_ledger" l WHERE l."fiscal_year_id" = fy."id")
  AND NOT EXISTS (SELECT 1 FROM "leave_year_openings" o WHERE o."fiscal_year_id" = fy."id");
--> statement-breakpoint
UPDATE "leave_types" SET "accrual_every_days" = 20 WHERE "statutory_code" = 'HOME' AND "accrual_every_days" IS NULL;
--> statement-breakpoint
UPDATE "leave_types" SET "expiry_days" = 21 WHERE "statutory_code" = 'SUBSTITUTE' AND "expiry_days" IS NULL;
