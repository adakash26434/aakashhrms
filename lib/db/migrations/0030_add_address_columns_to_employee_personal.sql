ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "permanent_address" text;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee_personal' AND column_name = 'address1') THEN
    UPDATE "employee_personal" SET "permanent_address" = "address1" WHERE "permanent_address" IS NULL AND "address1" IS NOT NULL;
    ALTER TABLE "employee_personal" ALTER COLUMN "address1" DROP NOT NULL;
  END IF;
END $$;--> statement-breakpoint
UPDATE "employee_personal" SET "permanent_address" = '' WHERE "permanent_address" IS NULL;--> statement-breakpoint
ALTER TABLE "employee_personal" ALTER COLUMN "permanent_address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "temporary_address" text;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee_personal' AND column_name = 'address2') THEN
    UPDATE "employee_personal" SET "temporary_address" = "address2" WHERE "temporary_address" IS NULL AND "address2" IS NOT NULL;
  END IF;
END $$;
