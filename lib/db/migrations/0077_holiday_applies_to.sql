-- 4.12c Holidays (S52): who gets the day off.
--   * holidays.applies_to: "everyone" (the default) or "women" (International Women's Day, a
--     public holiday for women only). Attendance and leave read it instead of looking for "women"
--     in the name; holidays whose name says so become women-only once, when the column is added.
DO $$
BEGIN
  IF to_regclass('holidays') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'holidays' AND column_name = 'applies_to') THEN
    ALTER TABLE "holidays" ADD COLUMN "applies_to" varchar(10) DEFAULT 'everyone' NOT NULL;
    UPDATE "holidays" SET "applies_to" = 'women' WHERE "name" ~* 'women';
  END IF;
END $$;
