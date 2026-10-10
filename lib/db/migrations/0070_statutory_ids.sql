-- 4.8 / F9: retirement-fund numbers on the employee record, used by the SSF contribution
-- schedule, the Provident Fund statement and the CIT statement. Optional; kept as typed. Idempotent.
ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "ssf_number" varchar(30);
ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "pf_number" varchar(30);
ALTER TABLE "employee_personal" ADD COLUMN IF NOT EXISTS "cit_number" varchar(30);
