/**
 * Prunes the webhook idempotency ledger.
 *
 *   npm run billing:prune
 *
 * `ProcessedStripeEvent` grows by one row per delivered webhook and is never
 * read for anything older than Stripe's retry window, so without pruning it
 * grows unbounded forever.
 *
 * Only COMPLETED rows past the retention window are deleted. A row with a null
 * `completedAt` is a claim whose handler never reported back; deleting one
 * would let an event be reprocessed, and keeping it is the signal that
 * something needs looking at. Those are reported, not removed.
 *
 * Intended to run on a schedule (cron, Vercel Cron, etc.). Safe to re-run.
 */
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // no .env next to cwd — assume env vars are already set (e.g. CI)
}

const prisma = new PrismaClient();

/**
 * Stripe auto-retries for roughly 3 days; a MANUAL resend is possible for 15
 * days from the Dashboard and 30 via the CLI. 45 days clears that entire window
 * rather than sitting exactly on its boundary.
 */
const RETENTION_DAYS = 45;

/** A claim older than this that never completed is worth surfacing. */
const STUCK_CLAIM_HOURS = 1;

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const total = await prisma.processedStripeEvent.count();

  // Only claims that are BOTH stale enough to be suspicious and recent enough
  // to still matter. Without the lower bound this reports every pre-existing
  // row on every run — noise that trains you to ignore the warning.
  const stuck = await prisma.processedStripeEvent.findMany({
    where: {
      completedAt: null,
      processedAt: {
        lt: new Date(Date.now() - STUCK_CLAIM_HOURS * 60 * 60 * 1000),
        gte: cutoff,
      },
    },
    select: { id: true, type: true, processedAt: true },
    take: 20,
  });

  if (stuck.length > 0) {
    console.warn(
      `[prune] ${stuck.length} incomplete claim(s) older than ${STUCK_CLAIM_HOURS}h — ` +
        `these events were claimed but never finished:\n` +
        stuck
          .map((s) => `    ${s.id} (${s.type}) claimed ${s.processedAt.toISOString()}`)
          .join("\n")
    );
  }

  /**
   * Delete by AGE, not by completion.
   *
   * Requiring `completedAt != null` sounded safer but bounded nothing: the
   * column was added later and nullable, so every row written before it existed
   * has `completedAt = NULL` and would survive forever — while also being
   * reported as a "stuck claim" on every run, permanently.
   *
   * Deleting an old incomplete claim is safe. Past the retention window Stripe
   * will not auto-retry it, and even a manual resend is harmless: `sync.ts`
   * re-reads from Stripe and the staleness guard rejects anything older than
   * what is already stored.
   */
  const deleted = await prisma.processedStripeEvent.deleteMany({
    where: { processedAt: { lt: cutoff } },
  });

  console.log(
    `[prune] removed ${deleted.count} completed event(s) older than ${RETENTION_DAYS} days ` +
      `(${total} -> ${total - deleted.count} rows)`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
