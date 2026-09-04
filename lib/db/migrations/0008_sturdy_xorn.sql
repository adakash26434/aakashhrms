CREATE TYPE "public"."action" AS ENUM('VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'LOCK');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('SYSTEM_CONTROL', 'FISCAL_YEAR', 'TAX_RATES', 'PAY_HEADS', 'HOLIDAYS', 'EMPLOYEES', 'SALARY_MAPPING', 'ATTENDANCE', 'LEAVE_APPLICATIONS', 'LEAVE_APPROVALS', 'LEAVE_RULES', 'LEAVE_TYPES', 'OT_RULES', 'PAYROLL_GENERATE', 'PAYROLL_REVIEW', 'LEAVE_SALARY', 'LOANS', 'REPORTS_SALARY_SHEET', 'REPORTS_PAYSLIP', 'REPORTS_ATTENDANCE', 'REPORTS_TAX_IRD', 'REPORTS_LEAVE', 'REPORTS_LOAN', 'USERS_ROLES', 'AUDIT_LOG', 'ORG_STRUCTURE', 'SELF_SERVICE');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('GLOBAL', 'BRANCH', 'DEPARTMENT', 'SELF');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role_id_at_time" uuid,
	"action" "action" NOT NULL,
	"module" "module" NOT NULL,
	"record_id" varchar(255),
	"result" varchar(50) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"rank_order" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "action" NOT NULL,
	"module" "module" NOT NULL,
	CONSTRAINT "permissions_action_module_unique" UNIQUE("action","module")
);
--> statement-breakpoint
CREATE TABLE "role_permission_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"affected_role_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_unique" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"delegated_to_user_id" uuid,
	"delegated_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_change_log" ADD CONSTRAINT "role_permission_change_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_change_log" ADD CONSTRAINT "role_permission_change_log_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_change_log" ADD CONSTRAINT "role_permission_change_log_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;