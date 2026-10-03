ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Grades entered before this flag existed were "by hand" when they had an amount but no grade count.
UPDATE "employees" SET "grade_manual" = true WHERE "grade_count" = 0 AND COALESCE("grade_amount", 0) > 0;
