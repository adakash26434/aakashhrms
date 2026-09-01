CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" varchar(30) NOT NULL,
	"in_time" varchar(20),
	"out_time" varchar(20),
	"work_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"ot_hours_office_day" numeric(5, 2) DEFAULT '0' NOT NULL,
	"ot_hours_off_day" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"is_manual_entry" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"allotted" numeric(5, 1) DEFAULT '0' NOT NULL,
	"taken" numeric(5, 1) DEFAULT '0' NOT NULL,
	"carried_forward" numeric(5, 1) DEFAULT '0' NOT NULL,
	"balance" numeric(5, 1) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"applied_date" date NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date NOT NULL,
	"duration" varchar(20) NOT NULL,
	"no_of_days" numeric(5, 1) NOT NULL,
	"reason" text NOT NULL,
	"remarks" text,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"review_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_ot_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"bs_month" integer NOT NULL,
	"total_working_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"present_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"absent_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"pay_leave_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"non_pay_leave_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"total_ot_hours_office" numeric(6, 2) DEFAULT '0' NOT NULL,
	"total_ot_hours_off" numeric(6, 2) DEFAULT '0' NOT NULL,
	"ot_earned_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"leave_deduction_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"locked_by_id" uuid,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" varchar(20) NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_rules_rule_name_unique" UNIQUE("rule_name")
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"leave_type" varchar(20) NOT NULL,
	"no_of_days" numeric(5, 1) NOT NULL,
	"carry_forward" boolean DEFAULT false NOT NULL,
	"applicable_departments" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"applicable_designations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ot_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" varchar(20) NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rate_office_day" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rate_off_day" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ot_rules_rule_name_unique" UNIQUE("rule_name")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD CONSTRAINT "leave_ot_calculations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD CONSTRAINT "leave_ot_calculations_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD CONSTRAINT "leave_ot_calculations_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;