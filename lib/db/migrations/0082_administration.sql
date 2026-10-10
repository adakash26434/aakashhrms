-- 4.13 Administration (S59).
--   * Audit entries record the request's client address, or nothing. Until now every company entry
--     written without an address was stored as 127.0.0.1 (the role screens wrote it outright): no
--     company entry ever recorded a real client address, so the placeholder becomes "not
--     recorded" (NULL). Once: the column comment, written in the same block, marks it done.
--   * A role whose permissions were ever changed could not be deleted (its change log rows held
--     it): the log keeps the role's name, so the link becomes ON DELETE SET NULL.
--   * One login per employee (a partial unique index; only when no employee has two already).
--   * The Audit log reads a period at a time: an index on created_at.
DO $$
BEGIN
  IF to_regclass('audit_logs') IS NOT NULL THEN
    IF col_description(to_regclass('audit_logs'), (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = to_regclass('audit_logs') AND a.attname = 'ip_address')) IS NULL THEN
      UPDATE "audit_logs" SET "ip_address" = NULL WHERE "ip_address" = '127.0.0.1';
      COMMENT ON COLUMN "audit_logs"."ip_address" IS 'Client address of the request (getClientIp); NULL = not recorded (S59).';
    END IF;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('role_permission_change_log') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permission_change_log_role_id_roles_id_fk' AND confdeltype = 'n'
  ) THEN
    ALTER TABLE "role_permission_change_log" ALTER COLUMN "role_id" DROP NOT NULL;
    ALTER TABLE "role_permission_change_log" DROP CONSTRAINT IF EXISTS "role_permission_change_log_role_id_roles_id_fk";
    ALTER TABLE "role_permission_change_log" ADD CONSTRAINT "role_permission_change_log_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('users') IS NOT NULL AND to_regclass('users_employee_id_unique') IS NULL
    AND NOT EXISTS (SELECT 1 FROM "users" WHERE "employee_id" IS NOT NULL GROUP BY "employee_id" HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX "users_employee_id_unique" ON "users" ("employee_id") WHERE "employee_id" IS NOT NULL;
  END IF;
END $$;
