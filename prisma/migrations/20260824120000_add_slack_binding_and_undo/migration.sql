-- Slack: bind one channel and one Slack identity to a connection.
--
-- All nullable. Rows created by the connect-only flow that shipped before the
-- channel picker have no channel and no bound identity, and no backfill can
-- invent one — nobody chose a channel. Those rows are treated as "pre-alpha"
-- and refused at command time with "reconnect Slack and pick a channel".
ALTER TABLE "slack_connections" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "channelName" TEXT,
ADD COLUMN     "ownerSlackUserId" TEXT,
ADD COLUMN     "scopes" TEXT NOT NULL DEFAULT '';

-- Jobs: which surface started them, and the undo snapshot.
--
-- `source` defaults to 'web', which is correct for every existing row. The
-- snapshot columns stay null until a job actually writes a page — they are
-- filled inside the same transaction as the write, so a snapshot exists if and
-- only if there is something to undo.
ALTER TABLE "site_generation_jobs" ADD COLUMN     "previousBlocks" JSONB,
ADD COLUMN     "previousPageExisted" BOOLEAN,
ADD COLUMN     "previousPath" TEXT,
ADD COLUMN     "previousStory" JSONB,
ADD COLUMN     "revertedAt" TIMESTAMP(3),
ADD COLUMN     "revertedBlocks" JSONB,
ADD COLUMN     "slackChannelId" TEXT,
ADD COLUMN     "slackMessageTs" TEXT,
ADD COLUMN     "slackUserId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN     "writtenBlocksHash" TEXT;
