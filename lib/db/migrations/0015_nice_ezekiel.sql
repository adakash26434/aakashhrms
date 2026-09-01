ALTER TABLE "payroll_runs" ADD COLUMN "designation_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "employee_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "employee_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "occasional_allowance_head_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "payslip_month" integer;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "payslip_date" varchar(20);--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN "payslip_month" integer;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD COLUMN "payslip_date" varchar(20);