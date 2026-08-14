import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { ALL_LOOKUP_KEYS } from "./plan";

/**
 * Resolves Stripe `lookup_key` → price at runtime.
 *
 * Price ids are deliberately not environment variables: a lookup key survives
 * a price change (create the new price with `transfer_lookup_key: true`), and
 * there is no test/live drift to keep in sync.
 */

const CACHE_TTL_MS = 60_000;

type Cache = { fetchedAt: number; byLookupKey: Map<string, Stripe.Price> };

let cache: Cache | null = null;

async function loadCatalog(): Promise<Map<string, Stripe.Price>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.byLookupKey;
  }

  const response = await getStripe().prices.list({
    lookup_keys: ALL_LOOKUP_KEYS,
    active: true,
    limit: 100,
  });

  const byLookupKey = new Map<string, Stripe.Price>();
  for (const price of response.data) {
    if (price.lookup_key) byLookupKey.set(price.lookup_key, price);
  }

  cache = { fetchedAt: Date.now(), byLookupKey };
  return byLookupKey;
}

/** Discards the cached catalog. Useful after a price change. */
export function invalidateCatalogCache(): void {
  cache = null;
}

/**
 * Throws rather than returning null. A silently-missing price would produce a
 * half-priced checkout, which is far worse than an error page.
 */
export async function getPriceByLookupKey(
  lookupKey: string
): Promise<Stripe.Price> {
  const catalog = await loadCatalog();
  const price = catalog.get(lookupKey);

  if (!price) {
    throw new Error(
      `No active Stripe price found for lookup_key "${lookupKey}". ` +
        `Run \`npm run stripe:bootstrap\` to create the catalog.`
    );
  }

  return price;
}

export async function getPriceIdByLookupKey(lookupKey: string): Promise<string> {
  return (await getPriceByLookupKey(lookupKey)).id;
}

/** Every catalog price, keyed by lookup key. Throws if any is missing. */
export async function getCatalog(): Promise<Map<string, Stripe.Price>> {
  const catalog = await loadCatalog();

  const missing = ALL_LOOKUP_KEYS.filter((key) => !catalog.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Missing active Stripe prices for: ${missing.join(", ")}. ` +
        `Run \`npm run stripe:bootstrap\` to create the catalog.`
    );
  }

  return catalog;
}

/** Minimal shape the UI needs to render a price without touching Stripe types. */
export type DisplayPrice = {
  lookupKey: string;
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
};

export function toDisplayPrice(price: Stripe.Price): DisplayPrice {
  return {
    lookupKey: price.lookup_key ?? "",
    priceId: price.id,
    unitAmount: price.unit_amount ?? 0,
    currency: price.currency,
    interval: price.recurring?.interval ?? "month",
  };
}
