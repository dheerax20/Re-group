-- GhlAccount has existed in schema.prisma and been used by lib/ghl/provision.ts
-- since the GHL work landed, but no migration was ever generated for it, so a
-- database built purely from this history was missing the table entirely and
-- provisioning failed at runtime. This is that missing migration, written to
-- match exactly what `prisma db push` produces for the model.
--
-- Guarded with IF NOT EXISTS because every environment that ran `db push` (or
-- was created before the gap was noticed) already has both objects.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GhlProvisionStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ghl_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT,
    "ghlUserId" TEXT,
    "status" "GhlProvisionStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ghl_accounts_userId_key" ON "ghl_accounts"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ghl_accounts" ADD CONSTRAINT "ghl_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
