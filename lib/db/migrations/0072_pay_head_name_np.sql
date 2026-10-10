-- 4.8 / F11: a pay head's Nepali name, printed on the bilingual payslip. Optional. Idempotent.
ALTER TABLE "pay_heads" ADD COLUMN IF NOT EXISTS "name_np" varchar(255);
