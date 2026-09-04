DELETE FROM "leave_rules";--> statement-breakpoint
-- Module values added in 0008 and ensured via schema sync outside transactions--> statement-breakpoint
ALTER TABLE "leave_rules" DROP CONSTRAINT "leave_rules_rule_name_unique";--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "leave_type_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "fiscal_year_id" uuid;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "rule_category" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "accrual_method" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "accrual_value" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "encashment_rate" varchar(30) DEFAULT 'BASIC_DAILY';--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "encashment_fixed_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN "min_service_days_for_eligibility" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "accumulation_cap" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "max_paid_days" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "is_statutory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "statutory_code" varchar(50);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "gender_applicable" varchar(20) DEFAULT 'All' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "requires_document" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "document_threshold_days" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "is_encashable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "encashment_basis" varchar(50);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "pro_rata_for_new_joinees" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD CONSTRAINT "leave_rules_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD CONSTRAINT "leave_rules_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_rules" DROP COLUMN "rule_type";--> statement-breakpoint
ALTER TABLE "leave_rules" DROP COLUMN "rate";