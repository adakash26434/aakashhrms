-- G6: automation & reminders. No daemon (cPanel/Passenger): cron curls /api/jobs/tick with a
-- bearer secret; the route runs every due job for every active company. Jobs are code-defined
-- (lib/engines/scheduler.engine.ts); these tables keep per-tenant state (last_run_day is the
-- once-per-Nepal-day claim) and a run log. Idempotent.
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(40) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_day" varchar(10),
  "last_run_at" timestamp,
  "last_status" varchar(10),
  "last_detail" text,
  CONSTRAINT "scheduled_jobs_code_unique" UNIQUE ("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "job_code" varchar(40) NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "status" varchar(10) DEFAULT 'running' NOT NULL,
  "detail" text,
  "items_processed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_job_code_idx" ON "job_runs" ("job_code", "started_at");
