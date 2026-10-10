-- 4.12b Pay heads (S51): an empty applicability list means every department / designation.
--   * The old Pay heads screen rewrote empty lists as lists of every department and designation
--     when it was opened (and the onboarding wizard stored them that way), so a head left out
--     every department or designation added afterwards. A list naming every department
--     (designation) that existed when the head was last saved becomes empty again: everyone.
--   * A list that leaves one out was a choice and stays as it is. created_at is written by the
--     database and updated_at by the app (UTC), so "existed" allows 6 hours for the server's time
--     zone (UTC or Nepal): a choice is never mistaken for everyone, and a head saved just before a
--     department was added keeps its list (Pay heads → For shows it; choose Everyone there).
-- Once: the column comments, written in the same block, mark it done and record the meaning.
DO $$
BEGIN
  IF to_regclass('pay_heads') IS NOT NULL AND to_regclass('departments') IS NOT NULL AND to_regclass('designations') IS NOT NULL THEN
    IF col_description(to_regclass('pay_heads'), (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = to_regclass('pay_heads') AND a.attname = 'applicable_department_ids')) IS NULL THEN
      UPDATE "pay_heads" p SET "applicable_department_ids" = ARRAY[]::text[]
        WHERE cardinality(p."applicable_department_ids") > 0
          AND NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."created_at" <= p."updated_at" + interval '6 hours' AND NOT (d."id"::text = ANY (p."applicable_department_ids")));
      UPDATE "pay_heads" p SET "applicable_designation_ids" = ARRAY[]::text[]
        WHERE cardinality(p."applicable_designation_ids") > 0
          AND NOT EXISTS (SELECT 1 FROM "designations" g WHERE g."created_at" <= p."updated_at" + interval '6 hours' AND NOT (g."id"::text = ANY (p."applicable_designation_ids")));
      COMMENT ON COLUMN "pay_heads"."applicable_department_ids" IS 'Department ids the head is for; empty = every department (S51).';
      COMMENT ON COLUMN "pay_heads"."applicable_designation_ids" IS 'Designation ids the head is for; empty = every designation (S51).';
    END IF;
  END IF;
END $$;
