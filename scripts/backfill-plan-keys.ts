/**
 * Backfills `SubscriptionItem.planKey` for subscriptions synced before plan
 * keys existed, by re-syncing every subscription from Stripe.
 *
 * Run from the repo root, ONCE, after deploying the plan-key change:
 *
 *   npm run billing:backfill
 *
 * Why it is needed: `planKey` was added as a nullable column. Existing rows
 * stay null until their subscription next emits a webhook, and a null plan key
 * makes an add-on invisible to `activeAddonKeys()` — the UI renders a paid-for
 * add-on as OFF, and enabling it appends a SECOND paid item. Idempotent and
 * safe to re-run.
 *
 * Prerequisite: `npm run stripe:bootstrap`, which stamps the plan metadata on
 * Stripe prices that this reads back.
 */
import { PrismaClient } from "@prisma/client";
import { syncSubscriptionFromStripe } from "../lib/billing/sync";

try {
  process.loadEnvFile();
} catch {
  // no .env next to cwd — assume env vars are already set (e.g. CI)
}

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.subscriptionItem.count({
    where: { planKey: null },
  });
  console.log(`[backfill] items with no planKey: ${before}`);

  const subscriptions = await prisma.subscription.findMany({
    select: { stripeSubscriptionId: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[backfill] re-syncing ${subscriptions.length} subscription(s)`);

  let synced = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      // No eventCreatedAt: this is a reconcile, so it cannot advance
      // lastEventAt or clobber a newer webhook's state.
      const result = await syncSubscriptionFromStripe(
        subscription.stripeSubscriptionId
      );
      if (result.synced) {
        synced += 1;
      } else {
        console.warn(
          `[backfill] ${subscription.stripeSubscriptionId} skipped: ${result.reason}`
        );
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[backfill] ${subscription.stripeSubscriptionId} failed:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const after = await prisma.subscriptionItem.count({ where: { planKey: null } });

  console.log(`[backfill] synced=${synced} failed=${failed}`);
  console.log(`[backfill] items with no planKey: ${before} -> ${after}`);

  if (after > 0) {
    const stuck = await prisma.subscriptionItem.findMany({
      where: { planKey: null },
      select: { stripePriceId: true, lookupKey: true },
    });
    console.warn(
      `[backfill] STILL UNRESOLVED — these prices carry no plan metadata:\n` +
        stuck
          .map((s) => `    ${s.stripePriceId} (lookup_key: ${s.lookupKey || "none"})`)
          .join("\n") +
        `\n  Stamp them by running \`npm run stripe:bootstrap\`, or set the ` +
        `regroup_plan_key metadata field on those prices in the Dashboard.`
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
