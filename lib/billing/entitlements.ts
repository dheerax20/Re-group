import type { Entitlement, Subscription, SubscriptionItem } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/db";
import { ADDON_KEYS, BASE, type AddonKey } from "./plan";

/**
 * Read helpers over the denormalized entitlement model.
 *
 * Feature gating reads THESE tables and never Stripe. The webhook keeps them
 * current via `sync.ts`; anything that queries Stripe on a page render is
 * both slow and wrong when a payment has failed.
 */

/** The statuses that mean "this subscription is worth showing/managing". */
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid"] as const;

export async function hasFeature(
  userId: string,
  featureKey: string
): Promise<boolean> {
  const entitlement = await withDbRetry(() =>
    prisma.entitlement.findUnique({
      where: { userId_featureKey: { userId, featureKey } },
      select: { id: true, expiresAt: true },
    })
  );

  if (!entitlement) return false;
  if (entitlement.expiresAt && entitlement.expiresAt.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

export async function listEntitlements(userId: string): Promise<Entitlement[]> {
  return withDbRetry(() =>
    prisma.entitlement.findMany({ where: { userId }, orderBy: { featureKey: "asc" } })
  );
}

/** True once the base plan has been paid for. The gate for the whole app. */
export function hasBasePlan(userId: string): Promise<boolean> {
  return hasFeature(userId, BASE.featureKey);
}

export type SubscriptionWithItems = Subscription & { items: SubscriptionItem[] };

/**
 * The user's current subscription, if any. `canceled` and `incomplete_expired`
 * are excluded so a dead subscription never blocks a fresh checkout.
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionWithItems | null> {
  return withDbRetry(() =>
    prisma.subscription.findFirst({
      where: {
        billingCustomer: { userId },
        status: { in: [...LIVE_STATUSES] },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    })
  );
}

/**
 * Which add-ons are currently on the subscription.
 *
 * Matches on `planKey`, never `lookupKey`. A lookup key moves to a new price
 * when a price is rotated, which would make a paid-for add-on look absent and
 * invite the UI to add a second one.
 */
export function activeAddonKeys(subscription: SubscriptionWithItems): AddonKey[] {
  return ADDON_KEYS.filter((key) =>
    subscription.items.some((item) => item.planKey === key)
  );
}

/** The Stripe subscription item id backing an add-on, for removal. */
export function subscriptionItemIdForAddon(
  subscription: SubscriptionWithItems,
  addonKey: AddonKey
): string | null {
  const item = subscription.items.find(
    (candidate) => candidate.planKey === addonKey
  );
  return item?.stripeSubscriptionItemId ?? null;
}
