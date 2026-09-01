CREATE TABLE "employee_salary_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salary_map_id" uuid NOT NULL,
	"pay_head_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"is_changeable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_salary_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"basic_salary" numeric(15, 2) NOT NULL,
	"grade_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"grade_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"loan1_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"loan2_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_salary_heads" ADD CONSTRAINT "employee_salary_heads_salary_map_id_employee_salary_map_id_fk" FOREIGN KEY ("salary_map_id") REFERENCES "public"."employee_salary_map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_heads" ADD CONSTRAINT "employee_salary_heads_pay_head_id_pay_heads_id_fk" FOREIGN KEY ("pay_head_id") REFERENCES "public"."pay_heads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD CONSTRAINT "employee_salary_map_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD CONSTRAINT "employee_salary_map_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_map" ADD CONSTRAINT "employee_salary_map_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;