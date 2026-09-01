CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"start_date" varchar(20) NOT NULL,
	"end_date" varchar(20) NOT NULL,
	"start_date_ad" timestamp NOT NULL,
	"end_date_ad" timestamp NOT NULL,
	"branch_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
