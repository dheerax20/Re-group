-- Per-page block trees. See the SitePage docblock in schema.prisma for why the
-- homepage deliberately stays on Site.blockConfig instead of moving here.

-- CreateTable
CREATE TABLE "site_pages" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "blockConfig" JSONB NOT NULL,
    "seoConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_pages_siteId_idx" ON "site_pages"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_siteId_path_key" ON "site_pages"("siteId", "path");

-- AddForeignKey
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
