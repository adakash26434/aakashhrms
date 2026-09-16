ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "full_name" varchar(255);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "is_supervisor" boolean DEFAULT false NOT NULL;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='first_name') THEN
    UPDATE "employees" SET "full_name" = TRIM(CONCAT(COALESCE("first_name", ''), ' ', COALESCE("last_name", ''))) WHERE "full_name" IS NULL OR "full_name" = '';
    ALTER TABLE "employees" ALTER COLUMN "first_name" DROP NOT NULL;
    ALTER TABLE "employees" ALTER COLUMN "last_name" DROP NOT NULL;
  END IF;
END $$;
