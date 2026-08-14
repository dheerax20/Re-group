/**
 * Idempotent Stripe catalog bootstrap.
 *
 * Creates the base plan and two add-ons, each with a recurring monthly price
 * carrying a stable `lookup_key`, plus an Entitlements Feature attached to the
 * product. Safe to re-run: everything is looked up by `lookup_key` first and
 * only created if absent.
 *
 * Run from the repo root:  npm run stripe:bootstrap
 *
 * Note on ordering: attaching a feature to a product is NOT retroactive.
 * Existing subscriptions only gain the entitlement at the start of their next
 * billing period, which is why catalog setup must precede any real signup.
 */

import Stripe from "stripe";
import {
  ADDONS,
  ADDON_KEYS,
  BASE,
  BASE_PLAN_KEY,
  FEATURE_KEY_METADATA_FIELD,
  PLAN_KEY_METADATA_FIELD,
  type AddonKey,
  type PlanKey,
} from "../lib/billing/plan";

try {
  process.loadEnvFile();
} catch {
  // no .env next to cwd — assume env vars are already set (e.g. CI)
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
});

/**
 * All prices MUST share one currency and one interval — Stripe requires a
 * single currency across a subscription's items, and mismatched intervals
 * would require flexible billing mode, which is deliberately out of scope.
 */
const CURRENCY = "usd";
const INTERVAL = "month" as const;

/**
 * Seed amounts, in the smallest currency unit (cents).
 *
 * These are used ONLY when a price does not already exist for the lookup key.
 * Once Stripe holds the price, Stripe is the source of truth and changing a
 * number here does nothing — see `lib/billing/catalog.ts` for how prices are
 * resolved at runtime, and rotate a live price with `transfer_lookup_key`.
 */
const SEED_AMOUNTS: Record<string, number> = {
  [BASE.lookupKey]: 9900, // $99.00
  [ADDONS.website.lookupKey]: 2900, // $29.00
  [ADDONS.automations.lookupKey]: 1900, // $19.00
};

type CatalogEntry = {
  planKey: PlanKey;
  productName: string;
  productDescription: string;
  unitAmount: number;
  lookupKey: string;
  featureName: string;
  featureLookupKey: string;
};

/**
 * Stamped onto every price. This is the STABLE identity the app reads to
 * decide what a subscription grants — `lookup_key` cannot serve that purpose
 * because rotating a price moves the key off the old price that existing
 * subscriptions still reference.
 */
function planMetadata(entry: CatalogEntry): Record<string, string> {
  return {
    [PLAN_KEY_METADATA_FIELD]: entry.planKey,
    [FEATURE_KEY_METADATA_FIELD]: entry.featureLookupKey,
  };
}

function seedAmountFor(lookupKey: string): number {
  const amount = SEED_AMOUNTS[lookupKey];
  if (amount === undefined) {
    throw new Error(`No seed amount configured for lookup_key "${lookupKey}"`);
  }
  return amount;
}

const CATALOG: CatalogEntry[] = [
  {
    planKey: BASE_PLAN_KEY,
    productName: BASE.label,
    productDescription: BASE.description,
    unitAmount: seedAmountFor(BASE.lookupKey),
    lookupKey: BASE.lookupKey,
    featureName: BASE.label,
    featureLookupKey: BASE.featureKey,
  },
  ...ADDON_KEYS.map((key: AddonKey) => ({
    planKey: key,
    productName: ADDONS[key].label,
    productDescription: ADDONS[key].description,
    unitAmount: seedAmountFor(ADDONS[key].lookupKey),
    lookupKey: ADDONS[key].lookupKey,
    featureName: ADDONS[key].label,
    featureLookupKey: ADDONS[key].featureKey,
  })),
];

/**
 * A price that already exists is reused as-is, but it must still satisfy the
 * subscription's hard constraints. `interval` and `tax_behavior` are IMMUTABLE
 * on a Stripe price, so a mismatch cannot be patched — it has to be a new
 * price with the lookup key transferred across. Failing loudly here beats
 * discovering it when Checkout rejects a mixed-interval subscription.
 */
function assertPriceUsable(price: Stripe.Price, entry: CatalogEntry): void {
  const problems: string[] = [];

  if (price.currency !== CURRENCY) {
    problems.push(`currency is "${price.currency}", expected "${CURRENCY}"`);
  }
  if (price.recurring?.interval !== INTERVAL) {
    problems.push(
      `interval is "${price.recurring?.interval}", expected "${INTERVAL}"`
    );
  }
  if (price.recurring && price.recurring.interval_count !== 1) {
    problems.push(
      `interval_count is ${price.recurring.interval_count}, expected 1`
    );
  }
  if (price.tax_behavior !== "exclusive") {
    problems.push(
      `tax_behavior is "${price.tax_behavior}", expected "exclusive"`
    );
  }

  if (problems.length === 0) return;

  throw new Error(
    `Price "${entry.lookupKey}" (${price.id}) is not usable:\n` +
      problems.map((p) => `  - ${p}`).join("\n") +
      `\n\ninterval and tax_behavior are immutable on a Stripe price. Fix by ` +
      `archiving this price, then creating a new one on the same product with ` +
      `interval=${INTERVAL}, tax_behavior=exclusive, and lookup_key=${entry.lookupKey}.`
  );
}

/**
 * Resolve the product for a plan, creating it only if it genuinely does not
 * exist.
 *
 * Product identity comes from the SAME stable plan metadata that prices carry —
 * not from the price's lookup key. Keying off the lookup key meant that an
 * archived or rotated price made this script believe the product was missing
 * and create a duplicate. That happened during implementation: two "Pro Plan"
 * products, one archived by hand.
 */
async function ensureProduct(entry: CatalogEntry): Promise<Stripe.Product> {
  /**
   * Strongly-consistent lookup FIRST.
   *
   * Stripe's Search API is eventually consistent — new objects typically take
   * under a minute to become searchable, longer during incidents, and Stripe
   * explicitly warns against using it in read-after-write flows. Search alone
   * would let a re-run moments after a partial failure miss the product it just
   * created and make a duplicate: exactly the bug this is meant to prevent.
   * Search is also unavailable in some regions.
   *
   * `prices.list` by lookup key is immediately consistent, and omitting
   * `active` returns archived prices too — so a product whose prices have all
   * been archived is still found through them.
   */
  const byLookupKey = await stripe.prices.list({
    lookup_keys: [entry.lookupKey],
    limit: 1,
    expand: ["data.product"],
  });

  const viaPrice = byLookupKey.data[0]?.product;
  if (viaPrice && typeof viaPrice !== "string" && !viaPrice.deleted) {
    console.log(
      `[product:exists] ${entry.planKey} -> ${viaPrice.id} (${viaPrice.name}) via price lookup`
    );
    return viaPrice;
  }

  // Fall back to search for the case the list cannot cover: the lookup key has
  // been rotated away entirely, so no price carries it.
  const existing = await stripe.products
    .search({
      query: `active:'true' AND metadata['${PLAN_KEY_METADATA_FIELD}']:'${entry.planKey}'`,
      limit: 1,
    })
    .catch((error: unknown) => {
      // Search is not available on every account/region — degrade rather than fail.
      console.warn(
        `[product:search-unavailable] ${entry.planKey}: ` +
          (error instanceof Error ? error.message : String(error))
      );
      return { data: [] as Stripe.Product[] };
    });

  const found = existing.data[0];
  if (found) {
    console.log(
      `[product:exists] ${entry.planKey} -> ${found.id} (${found.name}) via metadata search`
    );
    return found;
  }

  const product = await stripe.products.create({
    name: entry.productName,
    description: entry.productDescription,
    // Lets this script find the product again even if every price on it is
    // archived or has lost its lookup key.
    metadata: planMetadata(entry),
  });
  console.log(`[product:created] ${entry.productName} -> ${product.id}`);
  return product;
}

/** Resolve the price for a lookup key, creating the product + price if absent. */
async function ensurePrice(entry: CatalogEntry): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({
    lookup_keys: [entry.lookupKey],
    active: true,
    limit: 1,
  });

  const found = existing.data[0];
  if (found) {
    assertPriceUsable(found, entry);

    // Backfill plan metadata onto prices created before it existed. Metadata is
    // mutable, and without it `sync.ts` cannot tell what the price grants once
    // its lookup key is ever rotated away.
    const wanted = planMetadata(entry);
    const needsBackfill = Object.entries(wanted).some(
      ([key, value]) => found.metadata?.[key] !== value
    );

    if (needsBackfill) {
      const updated = await stripe.prices.update(found.id, { metadata: wanted });
      console.log(`[price:metadata] ${entry.lookupKey} -> stamped ${entry.planKey}`);
      return updated;
    }

    console.log(
      `[price:exists] ${entry.lookupKey} -> ${found.id} (${found.unit_amount} ${found.currency}/${found.recurring?.interval}, tax ${found.tax_behavior}, plan ${entry.planKey})`
    );
    return found;
  }

  const product = await ensureProduct(entry);

  const price = await stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: entry.unitAmount,
    recurring: { interval: INTERVAL },
    lookup_key: entry.lookupKey,
    // tax_behavior locks permanently once set — a mistake here means creating
    // a brand new price, so it is set now even though Stripe Tax is off.
    tax_behavior: "exclusive",
    // The stable plan identity. Carry this onto any future rotated price.
    metadata: planMetadata(entry),
  });
  console.log(
    `[price:created] ${entry.lookupKey} -> ${price.id} (${price.unit_amount} ${price.currency})`
  );

  return price;
}

/** Resolve the Entitlements Feature for a lookup key, creating it if absent. */
async function ensureFeature(
  entry: CatalogEntry
): Promise<Stripe.Entitlements.Feature> {
  const existing = await stripe.entitlements.features.list({
    lookup_key: entry.featureLookupKey,
    limit: 1,
  });

  const found = existing.data[0];
  if (found) {
    console.log(`[feature:exists] ${entry.featureLookupKey} -> ${found.id}`);
    return found;
  }

  const feature = await stripe.entitlements.features.create({
    name: entry.featureName,
    lookup_key: entry.featureLookupKey,
  });
  console.log(`[feature:created] ${entry.featureLookupKey} -> ${feature.id}`);
  return feature;
}

/** Attach the feature to the product unless it is already attached. */
async function ensureFeatureAttached(
  productId: string,
  feature: Stripe.Entitlements.Feature
): Promise<void> {
  const attached = await stripe.products.listFeatures(productId, { limit: 100 });

  const already = attached.data.some((productFeature) => {
    const entitlementFeature = productFeature.entitlement_feature;
    const id =
      typeof entitlementFeature === "string"
        ? entitlementFeature
        : entitlementFeature?.id;
    return id === feature.id;
  });

  if (already) {
    console.log(`[attach:exists] ${feature.lookup_key} -> ${productId}`);
    return;
  }

  await stripe.products.createFeature(productId, {
    entitlement_feature: feature.id,
  });
  console.log(`[attach:created] ${feature.lookup_key} -> ${productId}`);
}

/**
 * Ensures a default Customer Portal configuration exists.
 *
 * Deliberately WITHOUT `subscription_update`: the portal cannot update a
 * subscription carrying multiple products, which ours does as soon as an
 * add-on is enabled. Add-on changes go through /settings/billing instead. The
 * portal covers exactly what that screen does not — payment methods, invoice
 * history, and cancellation.
 */
async function ensurePortalConfiguration(): Promise<void> {
  const existing = await stripe.billingPortal.configurations.list({
    is_default: true,
    limit: 1,
  });

  const current = existing.data[0];
  if (current) {
    console.log(`[portal:exists] default configuration ${current.id}`);

    // A default we did not create (Dashboard-managed) may permit plan changes.
    // The portal cannot correctly update a multi-product subscription, so that
    // setting would let a customer break their own billing.
    if (current.features?.subscription_update?.enabled) {
      console.warn(
        `[portal:WARNING] the default configuration allows subscription_update. ` +
          `The Customer Portal cannot update a subscription with multiple ` +
          `products, which ours has whenever an add-on is enabled. Disable ` +
          `"Customers can switch plans" in the Dashboard portal settings — ` +
          `add-on changes belong in /settings/billing.`
      );
    }
    return;
  }

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Regroup — manage your billing",
    },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address", "name"],
      },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
      },
    },
  });

  console.log(`[portal:created] default configuration ${configuration.id}`);
}

/**
 * Stamps plan metadata on EVERY price of a product, not just the one currently
 * holding the lookup key.
 *
 * After a rotation the old price no longer holds the key, but existing
 * subscriptions still reference it — and that old price is exactly what
 * `sync.ts` reads to decide what the subscription grants. Stamping only the
 * key-holder would leave those subscribers unresolvable.
 */
async function stampAllPricesOnProduct(
  productId: string,
  entry: CatalogEntry
): Promise<void> {
  const wanted = planMetadata(entry);

  // The product itself carries the plan key too — it is how `ensureProduct`
  // finds it when every price has been archived or rotated.
  const product = await stripe.products.retrieve(productId);
  const productNeedsStamp = Object.entries(wanted).some(
    ([key, value]) => product.metadata?.[key] !== value
  );
  if (productNeedsStamp) {
    await stripe.products.update(productId, { metadata: wanted });
    console.log(`[product:metadata] ${productId} -> stamped ${entry.planKey}`);
  }

  const prices = await stripe.prices.list({ product: productId, limit: 100 });

  for (const price of prices.data) {
    const needsStamp = Object.entries(wanted).some(
      ([key, value]) => price.metadata?.[key] !== value
    );
    if (!needsStamp) continue;

    await stripe.prices.update(price.id, { metadata: wanted });
    console.log(
      `[price:metadata] ${price.id} (${price.active ? "active" : "archived"}, ` +
        `lookup_key: ${price.lookup_key ?? "none"}) -> stamped ${entry.planKey}`
    );
  }
}

async function main() {
  console.log(
    `[bootstrap] Stripe catalog — ${CURRENCY.toUpperCase()}, ${INTERVAL}ly, ${CATALOG.length} products`
  );

  for (const entry of CATALOG) {
    const price = await ensurePrice(entry);

    const productId =
      typeof price.product === "string" ? price.product : price.product.id;

    // Covers prices rotated away from the lookup key, which existing
    // subscriptions still reference.
    await stampAllPricesOnProduct(productId, entry);

    const feature = await ensureFeature(entry);
    await ensureFeatureAttached(productId, feature);
  }

  await ensurePortalConfiguration();

  console.log("[bootstrap] done — re-running this script makes no changes");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
