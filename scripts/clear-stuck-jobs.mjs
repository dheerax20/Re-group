/**
 * Marks QUEUED/RUNNING generation jobs as failed.
 *
 * Needed because a job whose Trigger.dev run was never picked up sits QUEUED
 * forever, and `startBuild` returns any active job instead of starting a new
 * one — so the church's Rebuild button is stuck until the row is cleared.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const { count } = await p.siteGenerationJob.updateMany({
  where: { status: { in: ["QUEUED", "RUNNING"] } },
  data: {
    status: "FAILED",
    error: "This build never started. Check that a Trigger.dev worker is running for this environment.",
    finishedAt: new Date(),
  },
});
console.log(`cleared ${count} stuck job(s)`);
await p.$disconnect();
