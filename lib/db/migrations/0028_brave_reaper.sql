ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);--> statement-breakpoint
ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "is_platform_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ot_rules" ADD COLUMN IF NOT EXISTS "platform_code" varchar(100);--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_protected" boolean DEFAULT false NOT NULL;