ALTER TABLE "employees" ADD COLUMN "salary_grade" varchar(50);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "grade_percent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "grade_amount" numeric(15, 2) DEFAULT '0';