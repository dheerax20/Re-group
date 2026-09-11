-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('VISITOR', 'REGULAR', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'VISITOR',
    "notes" TEXT,
    "ghlContactId" TEXT,
    "syncStatus" "MemberSyncStatus" NOT NULL DEFAULT 'PENDING',
    "syncError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Member_siteId_idx" ON "Member"("siteId");

-- CreateIndex
CREATE INDEX "Member_siteId_syncStatus_idx" ON "Member"("siteId", "syncStatus");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
