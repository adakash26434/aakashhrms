ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "grade_percent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "basic_salary" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD COLUMN IF NOT EXISTS "grade_percent" numeric(5, 2) DEFAULT '0' NOT NULL;
