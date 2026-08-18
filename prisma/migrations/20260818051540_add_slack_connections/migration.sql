-- CreateTable
CREATE TABLE "slack_connections" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackTeamName" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "botAccessToken" TEXT NOT NULL,
    "installedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_connections_siteId_key" ON "slack_connections"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_connections_slackTeamId_key" ON "slack_connections"("slackTeamId");

-- AddForeignKey
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
