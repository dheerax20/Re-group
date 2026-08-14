import { redirect } from "next/navigation";
import { getActiveSubscription, hasBasePlan } from "./entitlements";

/**
 * The paywall. Call this from any layout or page that requires a paid plan.
 *
 * Where it sends an unpaid user matters. A failed renewal moves a subscription
 * to `past_due`, which revokes entitlements but keeps the subscription live —
 * so `hasBasePlan()` is false while `getActiveSubscription()` still returns a
 * row. Sending that user to /upgrade would bounce straight off its own
 * "you already have an active subscription" redirect back to /settings/billing.
 * Routing them there directly is both correct and loop-free: billing is the
 * only screen that can actually fix a declined card.
 *
 * For the same reason this must NOT be called from `app/(app)/layout.tsx` —
 * /settings/billing renders inside that layout, so gating there would have the
 * layout redirect to a page it is itself responsible for rendering.
 */
export async function requireActivePlan(userId: string): Promise<void> {
  if (await hasBasePlan(userId)) return;

  const subscription = await getActiveSubscription(userId);
  redirect(subscription ? "/settings/billing" : "/upgrade");
}
