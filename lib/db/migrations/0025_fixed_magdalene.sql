ALTER TABLE "employee_personal" DROP CONSTRAINT "employee_personal_email_unique";--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "nid_no" varchar(100);--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "nid_issuing_district" varchar(100);--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "passport_issuing_district" varchar(100);--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "voter_id_issuing_district" varchar(100);--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "company_email" varchar(255);--> statement-breakpoint
ALTER TABLE "employee_personal" ADD COLUMN "personal_email" varchar(255);