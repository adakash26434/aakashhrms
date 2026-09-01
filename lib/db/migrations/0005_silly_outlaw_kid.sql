CREATE TABLE "tax_rate_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"amount_from" numeric(15, 2) NOT NULL,
	"amount_to" numeric(15, 2),
	"rate_percent" numeric(5, 2) NOT NULL,
	"fixed_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_rate_slabs" ADD CONSTRAINT "tax_rate_slabs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;