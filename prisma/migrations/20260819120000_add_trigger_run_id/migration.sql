-- The Trigger.dev run executing a generation job.
--
-- Nullable, and deliberately so: every job row written before this migration
-- ran under `after()` and has no run to point at, and backfilling a fake id
-- would make `buildStatus` hand the client a token for a run that does not
-- exist. Null simply means "no live run to subscribe to", which is the correct
-- reading for every one of those historical rows.
ALTER TABLE "site_generation_jobs" ADD COLUMN "triggerRunId" TEXT;

-- Looked up only when resuming an in-flight build, which is a handful of rows
-- at most, so the existing (siteId, createdAt) index already covers the query
-- that finds them. No index added here on purpose.
