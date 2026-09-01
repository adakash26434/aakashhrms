CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "branch_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "head_name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "designation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "employee_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;