import Stripe from "stripe";

/**
 * The API version is pinned deliberately. It matches the version bundled with
 * the installed `stripe` package, which is also what the SDK's TypeScript
 * types are generated against — `apiVersion` is typed as `LatestApiVersion`,
 * a single string literal, so this is the only value that type-checks.
 *
 * Do not "upgrade" this string on its own. Bump the `stripe` package and this
 * constant together, and re-read the changelog for breaking changes.
 */
export const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

let client: Stripe | null = null;

/**
 * Lazy singleton. Constructed on first use rather than at module load so that
 * importing a route handler (which `next build` does for every route) does not
 * require STRIPE_SECRET_KEY to be present.
 */
export function getStripe(): Stripe {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing required env var: STRIPE_SECRET_KEY");

  client = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });

  return client;
}
