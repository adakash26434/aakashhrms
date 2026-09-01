ALTER TABLE "leave_ot_calculations" ALTER COLUMN "is_locked" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employee_group_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_employee_group_id_employee_groups_id_fk" FOREIGN KEY ("employee_group_id") REFERENCES "public"."employee_groups"("id") ON DELETE set null ON UPDATE no action;