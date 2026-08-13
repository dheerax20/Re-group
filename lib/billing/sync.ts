import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStripe } from "./stripe";
import {
  BASE_PLAN_KEY,
  PLAN_KEY_METADATA_FIELD,
  featureKeyForPlan,
  isPlanKey,
  planKeyForLookupKey,
  sourceForPlan,
  type PlanKey,
} from "./plan";

/**
 * The ONLY writer to the billing tables.
 *
 * Route handlers call Stripe and return; the webhook calls this. Keeping a
 * single writer is what stops the database and Stripe from diverging when a
 * payment fails or someone edits a subscription in the Dashboard.
 *
 * Everything is re-read from Stripe rather than diffed out of the webhook
 * payload, which makes this safe to run on any event, in any order, any number
 * of times.
 */

/** Stripe's status strings map 1:1 onto the SubscriptionStatus enum. */
const KNOWN_STATUSES = new Set<string>([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

/** Only these grant access. Anything else revokes what that subscription gave. */
const ENTITLED_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

/**
 * Prisma's 5s interactive-transaction default is far too tight here.
 * `pg_advisory_xact_lock` blocks INSIDE the transaction, so time spent waiting
 * for another handler counts against this transaction's own budget. Stripe
 * delivers several events for a single checkout near-simultaneously, so the
 * last one in the queue can legitimately wait for all the others.
 */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

function toSubscriptionStatus(status: string): SubscriptionStatus {
  if (!KNOWN_STATUSES.has(status)) {
    throw new Error(`Unrecognized Stripe subscription status: "${status}"`);
  }
  return status as SubscriptionStatus;
}

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

type NormalizedItem = {
  stripeSubscriptionItemId: string;
  stripePriceId: string;
  lookupKey: string;
  planKey: PlanKey | null;
  quantity: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

/**
 * Resolves which plan a price represents.
 *
 * Order matters. Price METADATA is immutable for our purposes — the bootstrap
 * script stamps it once and nothing rotates it — whereas `lookup_key` moves to
 * a new price whenever a price is rotated. Reading metadata first is what keeps
 * existing subscribers entitled across a price change.
 */
export function resolvePlanKey(price: Stripe.Price): PlanKey | null {
  const fromMetadata = price.metadata?.[PLAN_KEY_METADATA_FIELD];
  if (isPlanKey(fromMetadata)) return fromMetadata;

  // Legacy path: items synced before plan keys existed. Correct only while the
  // price still holds its original lookup key.
  return price.lookup_key ? planKeyForLookupKey(price.lookup_key) : null;
}

/**
 * Billing periods live on the ITEM, not the subscription — Basil removed
 * `current_period_start` / `current_period_end` from the Subscription resource
 * and it has not come back. Reading them off the subscription returns
 * `undefined` silently, writing nulls into the database and quietly breaking
 * renewal logic.
 */
function normalizeItems(subscription: Stripe.Subscription): NormalizedItem[] {
  return subscription.items.data.map((item) => {
    const price = item.price;
    const planKey = resolvePlanKey(price);

    if (!planKey) {
      console.warn(
        `[billing:sync] price ${price.id} (lookup_key=${price.lookup_key ?? "none"}) ` +
          `has no ${PLAN_KEY_METADATA_FIELD} metadata and no recognized lookup key — ` +
          `it will grant nothing. Run \`npm run stripe:bootstrap\` to stamp metadata.`
      );
    }

    return {
      stripeSubscriptionItemId: item.id,
      stripePriceId: price.id,
      lookupKey: price.lookup_key ?? "",
      planKey,
      quantity: item.quantity ?? 1,
      currentPeriodStart: toDate(item.current_period_start),
      currentPeriodEnd: toDate(item.current_period_end),
    };
  });
}

/** Subscription-level period is derived from the base plan item. */
function derivePeriod(items: NormalizedItem[]): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const baseItem =
    items.find((item) => item.planKey === BASE_PLAN_KEY) ?? items[0];

  return {
    currentPeriodStart: baseItem?.currentPeriodStart ?? null,
    currentPeriodEnd: baseItem?.currentPeriodEnd ?? null,
  };
}

/**
 * Derives a stable 64-bit advisory-lock key from a string.
 *
 * Postgres' `hashtext()` is an undocumented internal function whose algorithm
 * is not guaranteed stable across versions, and its 32-bit output collides far
 * more readily — a collision here silently serialises two unrelated users
 * against each other. SHA-256 truncated to a signed 64-bit integer is explicit,
 * portable, and collision-free in practice.
 */
function advisoryLockKey(value: string): bigint {
  return createHash("sha256").update(value).digest().readBigInt64BE(0);
}

/**
 * Serializes concurrent handlers for one USER.
 *
 * The lock is keyed on the user, not the subscription, because the write target
 * that actually needs mutual exclusion — the entitlement set — is per-user. A
 * subscription-scoped lock would let two of a user's subscriptions recompute
 * entitlements concurrently and interleave.
 *
 * A transaction-scoped advisory lock is used rather than `SELECT ... FOR
 * UPDATE` because on the very first event there is no row to lock.
 */
async function acquireUserLock(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(userId)})`;
}

export type SyncResult =
  | { synced: true; subscriptionId: string; entitlements: string[] }
  | { synced: false; reason: "no_billing_customer" | "stale_event" };

export type SyncOptions = {
  /**
   * The Stripe event's `created` time, for webhook-driven syncs.
   *
   * Omit it for reconciliation syncs (the /onboarding fallback). Omitting has
   * two deliberate consequences: staleness is judged against when we READ from
   * Stripe rather than a fabricated timestamp, and `lastEventAt` is left
   * untouched so a wall-clock value can never cause genuine later webhooks to
   * be discarded as stale.
   */
  eventCreatedAt?: Date;
};

export async function syncSubscriptionFromStripe(
  stripeSubscriptionId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { eventCreatedAt } = options;

  // Fetched outside the transaction — a network round trip must never be held
  // inside a database lock. `fetchedAt` records how current this snapshot is,
  // which is what makes the staleness check below meaningful for reconcile
  // syncs that have no event timestamp of their own.
  const fetchedAt = new Date();
  const subscription = await getStripe().subscriptions.retrieve(
    stripeSubscriptionId,
    { expand: ["items.data.price"] }
  );

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const billingCustomer = await prisma.billingCustomer.findUnique({
    where: { stripeCustomerId },
  });

  if (!billingCustomer) {
    // Can legitimately happen for a customer created outside this app.
    // Creating one here would guess at the user, so bail loudly instead.
    console.error(
      `[billing:sync] no BillingCustomer for stripeCustomerId=${stripeCustomerId} ` +
        `(subscription=${stripeSubscriptionId}) — skipping`
    );
    return { synced: false, reason: "no_billing_customer" };
  }

  const status = toSubscriptionStatus(subscription.status);
  const items = normalizeItems(subscription);
  const period = derivePeriod(items);
  const userId = billingCustomer.userId;

  return prisma.$transaction(async (tx) => {
    await acquireUserLock(tx, userId);

    // Read AFTER taking the lock. Checking staleness outside the lock would
    // let a slower handler pass the check and then commit older data.
    const existing = await tx.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: { id: true, lastEventAt: true, stateReadAt: true },
    });

    /**
     * Two independent staleness tests, each comparing like with like.
     *
     * `staleByEvent` (Stripe clock): this event predates one already applied.
     *
     * `staleByRead` (local clock): the snapshot we are holding was read from
     * Stripe BEFORE the snapshot already stored. This applies to webhooks too,
     * not just reconciles — every sync re-reads full state from Stripe, so read
     * time is the only sound measure of how current our data is. Checking the
     * event clock alone let a webhook that had been waiting on the lock
     * overwrite a fresher reconcile and drag `stateReadAt` backwards, which in
     * turn re-opened the window for a second clobber.
     */
    const staleByEvent =
      eventCreatedAt != null &&
      existing?.lastEventAt != null &&
      eventCreatedAt < existing.lastEventAt;

    const staleByRead =
      existing?.stateReadAt != null && fetchedAt < existing.stateReadAt;

    if (staleByEvent || staleByRead) {
      return { synced: false, reason: "stale_event" } as const;
    }

    const data = {
      billingCustomerId: billingCustomer.id,
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      // Always true of the state being written, whatever triggered the sync.
      stateReadAt: fetchedAt,
      // Only a real Stripe event advances this watermark. A reconcile sync
      // must not stamp wall-clock time here, or later genuine webhooks whose
      // `created` predates it would be discarded as stale.
      ...(eventCreatedAt ? { lastEventAt: eventCreatedAt } : {}),
    };

    const saved = await tx.subscription.upsert({
      where: { stripeSubscriptionId },
      create: { stripeSubscriptionId, ...data },
      update: data,
    });

    // --- Items: mirror Stripe exactly -------------------------------------
    const keepIds = items.map((item) => item.stripeSubscriptionItemId);

    await tx.subscriptionItem.deleteMany({
      where: {
        subscriptionId: saved.id,
        ...(keepIds.length > 0
          ? { stripeSubscriptionItemId: { notIn: keepIds } }
          : {}),
      },
    });

    for (const item of items) {
      const itemData = {
        subscriptionId: saved.id,
        stripePriceId: item.stripePriceId,
        lookupKey: item.lookupKey,
        planKey: item.planKey,
        quantity: item.quantity,
        currentPeriodStart: item.currentPeriodStart,
        currentPeriodEnd: item.currentPeriodEnd,
      };

      await tx.subscriptionItem.upsert({
        where: { stripeSubscriptionItemId: item.stripeSubscriptionItemId },
        create: {
          stripeSubscriptionItemId: item.stripeSubscriptionItemId,
          ...itemData,
        },
        update: itemData,
      });
    }

    // --- Entitlements: recomputed from ALL of the user's subscriptions ----
    //
    // Scoping this to the subscription being synced would let a late-arriving
    // event for a LAPSED subscription wipe the entitlements of a newer, active
    // one. Entitlements are a function of the user's whole billing state, so
    // that is what they are derived from.
    const entitledSubscriptions = await tx.subscription.findMany({
      where: {
        billingCustomer: { userId },
        status: { in: ENTITLED_STATUSES },
      },
      include: { items: true },
    });

    const granted = new Map<string, string>(); // featureKey -> source
    for (const entitledSubscription of entitledSubscriptions) {
      for (const item of entitledSubscription.items) {
        if (!isPlanKey(item.planKey)) continue;
        granted.set(
          featureKeyForPlan(item.planKey),
          sourceForPlan(item.planKey)
        );
      }
    }

    const grantedKeys = [...granted.keys()];

    await tx.entitlement.deleteMany({
      where: {
        userId,
        ...(grantedKeys.length > 0 ? { featureKey: { notIn: grantedKeys } } : {}),
      },
    });

    // createMany + skipDuplicates rather than one upsert per row: this runs
    // under an advisory lock against a remote database, where each extra
    // round trip is real latency other webhook handlers wait on. `source` is
    // derived deterministically from the plan key, so leaving an existing row
    // untouched cannot make it stale — and it preserves `grantedAt`.
    if (grantedKeys.length > 0) {
      await tx.entitlement.createMany({
        data: grantedKeys.map((featureKey) => ({
          userId,
          featureKey,
          source: granted.get(featureKey) as string,
        })),
        skipDuplicates: true,
      });
    }

    console.log(
      `[billing:sync] ${stripeSubscriptionId} status=${status} ` +
        `items=${items.length} entitlements=${grantedKeys.length} ` +
        `source=${eventCreatedAt ? "webhook" : "reconcile"}`
    );

    return {
      synced: true,
      subscriptionId: saved.id,
      entitlements: grantedKeys,
    } as const;
  }, TRANSACTION_OPTIONS);
}
