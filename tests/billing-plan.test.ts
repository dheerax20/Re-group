import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  ADDONS,
  ADDON_KEYS,
  ALL_PLAN_KEYS,
  BASE,
  BASE_PLAN_KEY,
  featureKeyForPlan,
  isAddonKey,
  isPlanKey,
  planKeyForLookupKey,
  PLAN_KEY_METADATA_FIELD,
  sourceForPlan,
} from "@/lib/billing/plan";
import { resolvePlanKey } from "@/lib/billing/sync";

function price(overrides: Partial<Stripe.Price>): Stripe.Price {
  return { id: "price_1", metadata: {}, lookup_key: null, ...overrides } as Stripe.Price;
}

/**
 * The two rules this module exists to enforce, both of which have a real cost
 * when broken: entitlements must survive a Stripe price rotation, and no two
 * products may grant the same feature key.
 */
describe("resolvePlanKey", () => {
  it("prefers immutable price metadata over the mutable lookup key", () => {
    // The scenario that motivated planKey: a rotated price whose lookup_key has
    // moved on, but whose metadata still identifies the plan.
    const rotated = price({
      metadata: { [PLAN_KEY_METADATA_FIELD]: "website" },
      lookup_key: "some_old_rotated_key",
    });
    expect(resolvePlanKey(rotated)).toBe("website");
  });

  it("falls back to the lookup key for items synced before plan keys existed", () => {
    expect(resolvePlanKey(price({ lookup_key: BASE.lookupKey }))).toBe(BASE_PLAN_KEY);
    expect(resolvePlanKey(price({ lookup_key: ADDONS.website.lookupKey }))).toBe("website");
  });

  it("returns null rather than guessing when neither source identifies a plan", () => {
    expect(resolvePlanKey(price({ lookup_key: "unknown_key" }))).toBeNull();
    expect(resolvePlanKey(price({}))).toBeNull();
  });

  it("ignores metadata that is not a known plan key", () => {
    const bogus = price({
      metadata: { [PLAN_KEY_METADATA_FIELD]: "enterprise" },
      lookup_key: BASE.lookupKey,
    });
    expect(resolvePlanKey(bogus)).toBe(BASE_PLAN_KEY);
  });
});

describe("feature keys", () => {
  it("are disjoint across every plan", () => {
    // Entitlement has @@unique([userId, featureKey]); a duplicate here would make
    // the second upsert collide and leave `source` ambiguous on revoke.
    const keys = ALL_PLAN_KEYS.map(featureKeyForPlan);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("give every plan a distinct entitlement source", () => {
    const sources = ALL_PLAN_KEYS.map(sourceForPlan);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

describe("key guards", () => {
  it("accept only real add-on keys from client payloads", () => {
    for (const key of ADDON_KEYS) expect(isAddonKey(key)).toBe(true);
    for (const value of ["base", "price_123", "", null, undefined, {}]) {
      expect(isAddonKey(value)).toBe(false);
    }
  });

  it("treat base as a plan key but not an add-on key", () => {
    expect(isPlanKey(BASE_PLAN_KEY)).toBe(true);
    expect(isAddonKey(BASE_PLAN_KEY)).toBe(false);
  });
});

describe("planKeyForLookupKey", () => {
  it("maps configured lookup keys and nothing else", () => {
    expect(planKeyForLookupKey(BASE.lookupKey)).toBe(BASE_PLAN_KEY);
    expect(planKeyForLookupKey(ADDONS.automations.lookupKey)).toBe("automations");
    expect(planKeyForLookupKey("rotated_away")).toBeNull();
  });
});
