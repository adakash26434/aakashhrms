-- 4.3 Organization: departments are company-wide (optionally limited to some branches),
-- and the department head is picked from employees.
ALTER TABLE "departments" ALTER COLUMN "branch_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "head_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "branch_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "head_employee_id" uuid;--> statement-breakpoint
-- A typed head name that matches exactly one employee becomes that employee.
UPDATE "departments" d SET "head_employee_id" = m.id
FROM (
  SELECT lower(trim(full_name)) AS name, (array_agg(id))[1] AS id
  FROM "employees" GROUP BY lower(trim(full_name)) HAVING count(*) = 1
) m
WHERE d."head_employee_id" IS NULL AND d."head_name" IS NOT NULL AND lower(trim(d."head_name")) = m.name;
