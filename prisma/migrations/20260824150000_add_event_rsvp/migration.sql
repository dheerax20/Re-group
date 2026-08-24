-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "address" TEXT,
ADD COLUMN     "allowGuests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowWaitlist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "organizer" TEXT,
ADD COLUMN     "registrationDeadline" TIMESTAMP(3),
ADD COLUMN     "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "attendeeName" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "attendeePhone" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "dietaryNotes" TEXT,
    "prayerRequest" TEXT,
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_qrToken_key" ON "Registration"("qrToken");

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");

-- CreateIndex
CREATE INDEX "Registration_siteId_idx" ON "Registration"("siteId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
