-- At most one non-terminal generation job per (site, kind).
--
-- `ai.startBuild` checked for an active job and then inserted one. Two clicks
-- 200ms apart both passed the check before either row was visible, so both
-- created a job, both charged the monthly budget, and both triggered a run.
-- The idempotency key could not help: it is derived from the job id, and these
-- were two different job ids.
--
-- A check-then-insert cannot be made safe in application code without a lock,
-- so the uniqueness is enforced here instead. The second insert now loses at
-- the database, deterministically, and the caller turns that conflict into
-- "you already have a build running" rather than a second charge.

-- Any existing duplicates would block the index. Keep the newest active job
-- per (siteId, kind) and mark the rest failed — they are rows whose runs were
-- never picked up, which is exactly how the duplicates arose.
UPDATE "site_generation_jobs" AS j
SET "status" = 'FAILED',
    "error" = 'Superseded by a newer build.',
    "finishedAt" = NOW()
WHERE j."status" IN ('QUEUED', 'RUNNING')
  AND j."id" <> (
    SELECT k."id"
    FROM "site_generation_jobs" AS k
    WHERE k."siteId" = j."siteId"
      AND k."kind" = j."kind"
      AND k."status" IN ('QUEUED', 'RUNNING')
    ORDER BY k."createdAt" DESC
    LIMIT 1
  );

-- Partial, so terminal rows are unconstrained: the ledger keeps every historic
-- job for a site, and only the in-flight one is unique.
CREATE UNIQUE INDEX "site_generation_jobs_one_active_per_site_kind"
  ON "site_generation_jobs" ("siteId", "kind")
  WHERE "status" IN ('QUEUED', 'RUNNING');
