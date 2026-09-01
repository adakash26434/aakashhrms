CREATE TYPE "public"."leave_salary_run_status" AS ENUM('DRAFT', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'LOCKED');--> statement-breakpoint
CREATE TABLE "leave_salary_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"leave_days" numeric(5, 2) NOT NULL,
	"per_day_rate" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"payment_period" varchar(20) NOT NULL,
	"status" "leave_salary_run_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"pay_period_month" integer NOT NULL,
	"pay_period_year" integer NOT NULL,
	"pay_period_start_date" date NOT NULL,
	"pay_period_end_date" date NOT NULL,
	"branch_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"department_ids" text[] DEFAULT ARRAY[]::text[],
	"status" "payroll_run_status" DEFAULT 'DRAFT' NOT NULL,
	"total_gross" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_net_payable" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_tds" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_pf" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_ssf" numeric(15, 2) DEFAULT '0' NOT NULL,
	"employee_count" integer DEFAULT 0 NOT NULL,
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"approved_by" uuid,
	"approved_at" timestamp,
	"locked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_slip_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_slip_id" uuid NOT NULL,
	"pay_head_id" uuid NOT NULL,
	"pay_head_name" varchar(255) NOT NULL,
	"head_type" varchar(20) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"calculated_amount" numeric(15, 2) NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"override_reason" text
);
--> statement-breakpoint
CREATE TABLE "payroll_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_code" varchar(50) NOT NULL,
	"employee_name" varchar(255) NOT NULL,
	"department_name" varchar(255) NOT NULL,
	"designation_name" varchar(255) NOT NULL,
	"basic_salary" numeric(15, 2) NOT NULL,
	"grade_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gross_earnings" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_payable" numeric(15, 2) DEFAULT '0' NOT NULL,
	"taxable_income" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tds_this_month" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pf_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pf_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ssf_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ssf_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"cit_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"loan_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"absent_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ot_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"bank_account_number" varchar(100) NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"is_year_end_reconciliation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD CONSTRAINT "leave_salary_runs_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD CONSTRAINT "leave_salary_runs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD CONSTRAINT "leave_salary_runs_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_salary_runs" ADD CONSTRAINT "leave_salary_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slip_heads" ADD CONSTRAINT "payroll_slip_heads_payroll_slip_id_payroll_slips_id_fk" FOREIGN KEY ("payroll_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slip_heads" ADD CONSTRAINT "payroll_slip_heads_pay_head_id_pay_heads_id_fk" FOREIGN KEY ("pay_head_id") REFERENCES "public"."pay_heads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_payroll_slip_id_payroll_slips_id_fk" FOREIGN KEY ("payroll_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE set null ON UPDATE no action;