-- 4.12e Shift allowance: paid for each day worked on a shift that carries one, from the attendance
-- month, through the pay run.
--   * shifts.allowance_per_day: NPR for each day worked on the shift (0 = none).
--   * leave_ot_calculations.shift_allowance_amount: the month's allowance, frozen when the month
--     closes (the days and rates are in its summary).
--   * The SHIFT_ALLOWANCE system pay head (taxable), named "Shift allowance (attendance)" when the
--     company already has a head called "Shift allowance".
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "allowance_per_day" numeric(10,2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_ot_calculations" ADD COLUMN IF NOT EXISTS "shift_allowance_amount" numeric(15,2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT INTO "pay_heads" ("id", "code", "name", "name_np", "type", "effect_on_tax", "calc_basis", "calc_parameter", "calc_percent")
  SELECT md5('payhead:SHIFT_ALLOWANCE')::uuid, 'SHIFT_ALLOWANCE',
    CASE WHEN EXISTS (SELECT 1 FROM "pay_heads" WHERE lower("name") = 'shift allowance') THEN 'Shift allowance (attendance)' ELSE 'Shift allowance' END,
    'सिफ्ट भत्ता', 'allowance', true, 'None', 'FixedAmount', 0
  WHERE NOT EXISTS (SELECT 1 FROM "pay_heads" WHERE "code" = 'SHIFT_ALLOWANCE');
