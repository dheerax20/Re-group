import type Stripe from "stripe";
import { getCurrentUser } from "@/lib/auth/session";
import { getPriceIdByLookupKey } from "./catalog";
import {
  getActiveSubscription,
  subscriptionItemIdForAddon,
  type SubscriptionWithItems,
} from "./entitlements";
import { ADDONS, isAddonKey, type AddonKey } from "./plan";
import { getStripe } from "./stripe";
import { resolvePlanKey } from "./sync";

/**
 * Shared logic for the two add-on management routes.
 *
 * The ownership rule lives here so both routes get it: the subscription is
 * always loaded via the AUTHENTICATED user's BillingCustomer. A client-supplied
 * subscription id is never trusted — that is how you end up modifying someone
 * else's plan.
 */

/** Stripe rejects an invoice below its minimum charge (~$0.50 USD). */
export const STRIPE_MINIMUM_CHARGE = 50;

/** A quote older than this is refused; the charge would diverge from it. */
export const PRORATION_DATE_MAX_AGE_SECONDS = 5 * 60;

export type AddonChange = { addon: AddonKey; enabled: boolean };

export type ResolvedContext = {
  userId: string;
  subscription: SubscriptionWithItems;
};

export type ContextError = { status: number; error: string };

export function isContextError(
  value: ResolvedContext | ContextError
): value is ContextError {
  return "error" in value;
}

/** Authenticates, then loads the caller's own subscription. */
export async function resolveContext(): Promise<ResolvedContext | ContextError> {
  const user = await getCurrentUser();
  if (!user) return { status: 401, error: "Not authenticated" };

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return { status: 404, error: "No active subscription" };
  }

  /**
   * Refuse to touch a subscription whose items we cannot identify.
   *
   * An item with a null `planKey` is invisible to `activeAddonKeys()` and to
   * `subscriptionItemIdForAddon()`, so the UI would render a paid-for add-on
   * as OFF and "enabling" it would append a SECOND paid item for the same
   * product. Failing loudly here is strictly better than billing twice.
   *
   * Recovery is a re-sync, which repopulates plan keys from price metadata:
   *   npm run billing:backfill
   */
  const unresolved = subscription.items.filter((item) => item.planKey === null);
  if (unresolved.length > 0) {
    console.error(
      `[billing:addons] subscription ${subscription.stripeSubscriptionId} has ` +
        `${unresolved.length} item(s) with no planKey ` +
        `(${unresolved.map((i) => i.stripePriceId).join(", ")}) — refusing to modify`
    );
    return {
      status: 409,
      error:
        "We're still syncing your plan details. Please refresh in a moment or contact support.",
    };
  }

  return { userId: user.id, subscription };
}

/** Validates a `changes` payload into typed add-on changes. */
export function parseChanges(
  raw: unknown
): { changes: AddonChange[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "No changes requested" };
  }

  const changes: AddonChange[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return { error: "Malformed change entry" };
    }
    const { addon, enabled } = entry as Record<string, unknown>;

    // Add-on KEYS only — never a price id.
    if (!isAddonKey(addon)) return { error: `Unknown add-on: ${String(addon)}` };
    if (typeof enabled !== "boolean") {
      return { error: `"enabled" must be a boolean for ${addon}` };
    }

    if (changes.some((change) => change.addon === addon)) {
      return { error: `Duplicate change for ${addon}` };
    }

    changes.push({ addon, enabled });
  }

  return { changes };
}

/**
 * Drops changes that are already true of the subscription, so a no-op save
 * never reaches Stripe.
 */
export function pendingChanges(
  subscription: SubscriptionWithItems,
  changes: AddonChange[]
): AddonChange[] {
  return changes.filter((change) => {
    const present =
      subscriptionItemIdForAddon(subscription, change.addon) !== null;
    return present !== change.enabled;
  });
}

/**
 * Builds the `items` array for a subscription update.
 *
 * This is a PARTIAL update: only the items being changed are sent. Untouched
 * items are preserved by Stripe — sending the full array is how you
 * accidentally drop the base plan.
 */
export async function buildItems(
  subscription: SubscriptionWithItems,
  changes: AddonChange[]
): Promise<Stripe.SubscriptionUpdateParams.Item[]> {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [];

  for (const change of changes) {
    if (change.enabled) {
      const price = await getPriceIdByLookupKey(ADDONS[change.addon].lookupKey);
      items.push({ price, quantity: 1 });
    } else {
      const itemId = subscriptionItemIdForAddon(subscription, change.addon);
      if (itemId) items.push({ id: itemId, deleted: true });
    }
  }

  return items;
}

/**
 * Last line of defence against double-billing, checked against LIVE Stripe
 * state rather than our database.
 *
 * Every duplicate-item bug in this module has the same shape: the local view of
 * the subscription is stale (webhook not yet arrived, a request whose outcome
 * was unknown, a client that re-offered an applied change), so "enable" is
 * computed for an add-on Stripe already has. Adding an item without an `id`
 * makes Stripe append a SECOND paid item for the same product.
 *
 * Filtering against Stripe itself makes that structurally impossible, whatever
 * the client or the database believe.
 */
export async function dropAlreadyAppliedChanges(
  stripeSubscriptionId: string,
  changes: AddonChange[]
): Promise<{ effective: AddonChange[]; skipped: AddonChange[] }> {
  const live = await getStripe().subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const presentPlans = new Set<string>();
  for (const item of live.items.data) {
    const planKey = resolvePlanKey(item.price);
    if (planKey) presentPlans.add(planKey);
  }

  const effective: AddonChange[] = [];
  const skipped: AddonChange[] = [];

  for (const change of changes) {
    const alreadyThere = presentPlans.has(change.addon);
    // enabling something Stripe already has, or removing something it lacks
    if (change.enabled === alreadyThere) {
      skipped.push(change);
    } else {
      effective.push(change);
    }
  }

  return { effective, skipped };
}

/**
 * `preview.total` includes the NEXT renewal charge and would badly overstate
 * what is due now. Only proration lines belong in the "due today" figure.
 */
export function sumProrationLines(preview: Stripe.Invoice): number {
  return preview.lines.data
    .filter((line) => line.parent?.subscription_item_details?.proration)
    .reduce((sum, line) => sum + line.amount, 0);
}

/** A stable idempotency key for a set of changes at a given proration date. */
export function idempotencyKeyFor(
  stripeSubscriptionId: string,
  changes: AddonChange[],
  prorationDate: number
): string {
  const digest = [...changes]
    .sort((a, b) => a.addon.localeCompare(b.addon))
    .map((change) => `${change.addon}:${change.enabled}`)
    .join(",");

  return `addon:${stripeSubscriptionId}:${digest}:${prorationDate}`;
}
