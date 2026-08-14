/**
 * The plan catalog as the application knows it.
 *
 * This file holds identifiers and display copy only — never prices. Amounts
 * live in Stripe and are resolved at runtime through `catalog.ts`, so raising
 * a price never requires a redeploy. The seed amounts used to create the
 * Stripe objects in the first place live in
 * `scripts/bootstrap-stripe-catalog.ts`.
 *
 * Feature keys must stay DISJOINT across base and add-ons: `Entitlement` has
 * `@@unique([userId, featureKey])`, so two products granting the same key
 * would collide on upsert and make `source` ambiguous on revoke.
 */

export const BASE = {
  lookupKey: "regroup_base_monthly",
  featureKey: "regroup_base",
  label: "Regroup Base",
  description: "Basic plan with course builder and attendance management",
} as const;

export const ADDONS = {
  website: {
    lookupKey: "website_builder_monthly",
    featureKey: "website_builder",
    label: "Website Builder with AI",
    description: "Create websites with AI templates and enhance your reach",
  },
  automations: {
    lookupKey: "ghl_automations_monthly",
    featureKey: "ghl_automations",
    label: "Automations with GHL",
    description: "Create automations with GHL",
  },
} as const;

export type AddonKey = keyof typeof ADDONS;

export const ADDON_KEYS = Object.keys(ADDONS) as AddonKey[];

/**
 * The only way an add-on key enters the system from a client payload. The
 * client sends keys, never price ids — a client-supplied price id would be a
 * pricing-bypass vulnerability.
 */
export const isAddonKey = (v: unknown): v is AddonKey =>
  typeof v === "string" && v in ADDONS;

/** Every lookup key the catalog must be able to resolve. */
export const ALL_LOOKUP_KEYS: string[] = [
  BASE.lookupKey,
  ...ADDON_KEYS.map((key) => ADDONS[key].lookupKey),
];

/**
 * The stable identity of a plan, independent of any Stripe object.
 *
 * A Stripe `lookup_key` is MUTABLE — rotating a price with
 * `transfer_lookup_key: true` moves the key off the old price, and existing
 * subscriptions keep pointing at that old price. Deriving what a subscription
 * grants from `lookup_key` therefore silently de-entitles every existing
 * subscriber the first time a price changes.
 *
 * `PlanKey` is written into immutable price metadata at catalog bootstrap and
 * persisted on `SubscriptionItem.planKey`. Feature gating reads THIS.
 */
export const BASE_PLAN_KEY = "base" as const;
export type PlanKey = typeof BASE_PLAN_KEY | AddonKey;

export const ALL_PLAN_KEYS: PlanKey[] = [BASE_PLAN_KEY, ...ADDON_KEYS];

export const isPlanKey = (v: unknown): v is PlanKey =>
  typeof v === "string" && (ALL_PLAN_KEYS as string[]).includes(v);

/** Metadata keys written onto Stripe prices by the bootstrap script. */
export const PLAN_KEY_METADATA_FIELD = "regroup_plan_key";
export const FEATURE_KEY_METADATA_FIELD = "regroup_feature_key";

/** `Entitlement.source` values, mirroring the schema comment. */
export const BASE_SOURCE = "base";
export const addonSource = (key: AddonKey) => `addon_${key}`;

/** The lookup key currently configured for a plan (used to resolve a price to buy). */
export function lookupKeyForPlan(planKey: PlanKey): string {
  return planKey === BASE_PLAN_KEY
    ? BASE.lookupKey
    : ADDONS[planKey].lookupKey;
}

/** What a plan grants. Stable — never derived from a Stripe field. */
export function featureKeyForPlan(planKey: PlanKey): string {
  return planKey === BASE_PLAN_KEY
    ? BASE.featureKey
    : ADDONS[planKey].featureKey;
}

/** `Entitlement.source` for a plan. */
export function sourceForPlan(planKey: PlanKey): string {
  return planKey === BASE_PLAN_KEY ? BASE_SOURCE : addonSource(planKey);
}

/**
 * Legacy fallback ONLY, for subscription items synced before plan keys
 * existed. Returns null once a lookup key has been rotated away, which is
 * precisely why it must not be the primary resolution path.
 */
export function planKeyForLookupKey(lookupKey: string): PlanKey | null {
  if (lookupKey === BASE.lookupKey) return BASE_PLAN_KEY;
  return ADDON_KEYS.find((key) => ADDONS[key].lookupKey === lookupKey) ?? null;
}
