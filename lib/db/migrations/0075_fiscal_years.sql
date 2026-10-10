-- 4.12 Fiscal years (S49): labels by the BS years, and only the three statuses.
--   * The old screen built a new year's label from its AD years ("FY 2026/27" for FY 2083/84).
--     Every label becomes "FY <opening BS year>/<next year's last two digits>", the opening year
--     read from start_date_bs (a start stored a day early is still Asar of the same BS year).
--   * A status other than Active / Inactive / Locked (written by hand or by an older build) becomes
--     Inactive, which is what the app already reads it as: close the year again under Setup →
--     Fiscal years if it was meant to be closed.
-- Idempotent.
UPDATE "fiscal_years"
  SET "label" = 'FY ' || left("start_date_bs", 4) || '/' || right((left("start_date_bs", 4)::int + 1)::text, 2), "updated_at" = now()
  WHERE "start_date_bs" ~ '^[0-9]{4}-'
    AND "label" <> 'FY ' || left("start_date_bs", 4) || '/' || right((left("start_date_bs", 4)::int + 1)::text, 2);
--> statement-breakpoint
UPDATE "fiscal_years" SET "status" = 'Inactive', "updated_at" = now() WHERE "status" NOT IN ('Active', 'Inactive', 'Locked');
