CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"from_month" integer NOT NULL,
	"to_month" integer NOT NULL,
	"start_date_ad" timestamp NOT NULL,
	"end_date_ad" timestamp NOT NULL,
	"start_date_bs" varchar(20) NOT NULL,
	"end_date_bs" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'Active' NOT NULL,
	"payslips_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_years_slug_unique" UNIQUE("slug")
);
