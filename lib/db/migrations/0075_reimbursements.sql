-- 4.8 / F16: reimbursements (medical, mobile / internet, fuel, uniform and similar) claimed with a
-- bill, approved by someone else (never one's own, S21) and paid through the pay run on two system
-- heads: REIMBURSE (not taxable) and REIMBURSE_TAX (taxable), as each type says. A type can cap a
-- claim and the fiscal year per employee. Adds the REIMBURSEMENTS permission module (System
-- Administrator all; HR Manager VIEW / ADD / EDIT / APPROVE; Payroll Controller VIEW / LOCK — LOCK
-- marks a claim paid by hand). Idempotent; PG10-safe ids (md5). ALTER TYPE runs outside transactions.
ALTER TYPE "public"."module" ADD VALUE IF NOT EXISTS 'REIMBURSEMENTS';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_types" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_np" varchar(100),
  "taxable" boolean DEFAULT false NOT NULL,
  "per_claim_cap" numeric(12,2) DEFAULT 0 NOT NULL,
  "yearly_cap" numeric(12,2) DEFAULT 0 NOT NULL,
  "receipt_required" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "reimbursement_types_code_key" UNIQUE ("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_claims" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "type_id" uuid NOT NULL REFERENCES "reimbursement_types"("id") ON DELETE RESTRICT,
  "expense_date" date NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "receipt_no" varchar(60),
  "description" text NOT NULL,
  "taxable" boolean DEFAULT false NOT NULL,
  "status" varchar(10) DEFAULT 'draft' NOT NULL,
  "decision_note" text,
  "decided_by" uuid,
  "decided_at" timestamp,
  "settled_at" timestamp,
  "payroll_run_id" uuid REFERENCES "payroll_runs"("id") ON DELETE SET NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimbursement_claims_employee_idx" ON "reimbursement_claims" ("employee_id", "expense_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimbursement_claims_status_idx" ON "reimbursement_claims" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimbursement_claims_run_idx" ON "reimbursement_claims" ("payroll_run_id");
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:REIMBURSE')::uuid, 'REIMBURSE', 'Reimbursement', 'allowance', false, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'REIMBURSE');
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
SELECT md5('payhead:REIMBURSE_TAX')::uuid, 'REIMBURSE_TAX', 'Reimbursement (taxable)', 'allowance', true, 'None', 'FixedAmount', 0
WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'REIMBURSE_TAX');
--> statement-breakpoint
INSERT INTO "permissions" ("id", "action", "module")
SELECT md5('perm:' || a || ':REIMBURSEMENTS')::uuid, a::action, 'REIMBURSEMENTS'::module
FROM unnest(ARRAY['VIEW','ADD','EDIT','DELETE','APPROVE','EXPORT','LOCK']) AS a
ON CONFLICT ("action", "module") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT md5('rp:' || r."id"::text || ':' || p."id"::text)::uuid, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'REIMBURSEMENTS'
  AND (r."slug" = 'system_admin' OR (r."slug" = 'hr_manager' AND p."action" IN ('VIEW', 'ADD', 'EDIT', 'APPROVE')) OR (r."slug" = 'payroll_controller' AND p."action" IN ('VIEW', 'LOCK')))
WHERE r."slug" IN ('system_admin', 'hr_manager', 'payroll_controller')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
