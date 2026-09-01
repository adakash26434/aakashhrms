CREATE TABLE "system_config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"data_type" varchar(20) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
