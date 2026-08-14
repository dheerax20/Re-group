import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasBasePlan, listEntitlements } from "@/lib/billing/entitlements";
import { getStripe } from "@/lib/billing/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/sync";

export const runtime = "nodejs";

/**
 * Lightweight poll target for `/welcome`.
 *
 * Since Basil, Checkout postpones subscription creation until after payment
 * completes, so the success redirect routinely arrives before the webhook.
 * That race is expected — this endpoint lets the page wait it out.
 *
 * With `?fallback=1` and a `session_id`, it will also sync directly from
 * Stripe rather than waiting. The client only sets that after a few seconds,
 * so the webhook stays the normal path and this stays the exception.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await hasBasePlan(user.id)) {
    const entitlements = await listEntitlements(user.id);
    return NextResponse.json({
      ready: true,
      entitlements: entitlements.map((entitlement) => entitlement.featureKey),
    });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  const useFallback = request.nextUrl.searchParams.get("fallback") === "1";

  if (sessionId && useFallback) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);

      // The session must belong to THIS user — session_id comes from a URL and
      // is not proof of anything on its own.
      if (session.client_reference_id !== user.id) {
        return NextResponse.json({ ready: false, entitlements: [] });
      }

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (subscriptionId) {
        // No eventCreatedAt: this is a reconcile, not a webhook. That makes the
        // staleness check compare against when we read from Stripe, and leaves
        // `lastEventAt` untouched so this cannot cause later genuine webhooks
        // to be discarded. Idempotent, so racing the webhook is harmless.
        await syncSubscriptionFromStripe(subscriptionId);

        const entitlements = await listEntitlements(user.id);
        return NextResponse.json({
          // Must agree with the gate /welcome actually uses, or the client
          // stops polling while the server keeps rendering the waiting state.
          ready: await hasBasePlan(user.id),
          entitlements: entitlements.map((e) => e.featureKey),
          viaFallback: true,
        });
      }
    } catch (error) {
      console.error("[billing:status] fallback sync failed", error);
    }
  }

  return NextResponse.json({ ready: false, entitlements: [] });
}
