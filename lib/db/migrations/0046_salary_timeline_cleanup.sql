-- 4.4 fix (follow-up to the 4.6e back-fill fix): before that fix, the restart-time schema sync
-- back-filled a "Submitted" and a decision step (ids md5(<batch>:submitted / :decided)) for
-- every salary change, also for changes that already had their own steps, so their timelines
-- showed those steps twice. Remove only those back-filled copies: the Submitted copy where the
-- change has its own Submitted step, the decision copy where it has its own decision. Changes
-- with no steps of their own keep the back-filled ones. Idempotent.
DELETE FROM "approval_actions" a
WHERE a."module" = 'SALARY_MAPPING'
  AND a."id" = md5(a."request_id"::text || ':submitted')::uuid
  AND EXISTS (
    SELECT 1 FROM "approval_actions" o
    WHERE o."module" = 'SALARY_MAPPING' AND o."request_id" = a."request_id" AND o."action" = 'submitted'
      AND o."id" NOT IN (md5(a."request_id"::text || ':submitted')::uuid, md5(a."request_id"::text || ':decided')::uuid)
  );
--> statement-breakpoint
DELETE FROM "approval_actions" a
WHERE a."module" = 'SALARY_MAPPING'
  AND a."id" = md5(a."request_id"::text || ':decided')::uuid
  AND EXISTS (
    SELECT 1 FROM "approval_actions" o
    WHERE o."module" = 'SALARY_MAPPING' AND o."request_id" = a."request_id" AND o."action" <> 'submitted'
      AND o."id" NOT IN (md5(a."request_id"::text || ':submitted')::uuid, md5(a."request_id"::text || ':decided')::uuid)
  );
