CREATE TABLE "employee_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"branch_name" varchar(255) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_family" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"father_name" varchar(255),
	"mother_name" varchar(255),
	"spouse_name" varchar(255),
	"grandfather_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "employee_personal" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"citizenship_no" varchar(100) NOT NULL,
	"issuing_district" varchar(100) NOT NULL,
	"passport_no" varchar(100),
	"voters_id" varchar(100),
	"phone_home" varchar(50),
	"mobile_no" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"address1" text NOT NULL,
	"address2" text,
	CONSTRAINT "employee_personal_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "employee_termination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"informed_date" date,
	"termination_date" date,
	"type" varchar(100),
	"reason" text,
	"plan" varchar(100),
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" varchar(50) NOT NULL,
	"attendance_code" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"gender" varchar(20) NOT NULL,
	"date_of_birth" date NOT NULL,
	"tax_status" varchar(50) NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"category" varchar(50) NOT NULL,
	"shreni" varchar(100),
	"department_id" uuid NOT NULL,
	"designation_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"supervisor_id" uuid,
	"joining_date" date NOT NULL,
	"confirmation_date" date,
	"retirement_date_projected" date,
	"status" varchar(50) DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "employees_attendance_code_unique" UNIQUE("attendance_code")
);
--> statement-breakpoint
ALTER TABLE "employee_bank" ADD CONSTRAINT "employee_bank_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_family" ADD CONSTRAINT "employee_family_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_personal" ADD CONSTRAINT "employee_personal_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_termination" ADD CONSTRAINT "employee_termination_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;