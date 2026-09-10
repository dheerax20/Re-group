-- CreateTable
CREATE TABLE "ghl_oauth_tokens" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "userType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghl_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ghl_oauth_tokens_companyId_locationId_key" ON "ghl_oauth_tokens"("companyId", "locationId");

-- CreateIndex
CREATE INDEX "ghl_oauth_tokens_companyId_idx" ON "ghl_oauth_tokens"("companyId");
