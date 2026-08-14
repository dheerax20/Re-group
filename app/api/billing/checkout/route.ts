import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrCreateBillingCustomer } from "@/lib/billing/customer";
import { getPriceIdByLookupKey } from "@/lib/billing/catalog";
import { getActiveSubscription } from "@/lib/billing/entitlements";
import { ADDONS, BASE, isAddonKey, type AddonKey } from "@/lib/billing/plan";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  addons: z.array(z.string()).max(10).optional().default([]),
});

export async function POST(request: NextRequest) {
  // Not syncCurrentUser(): a redirect is useless to fetch(), so answer 401.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // The client sends add-on KEYS. Anything else — notably a raw Stripe price
  // id — is rejected outright rather than filtered out, so a pricing-bypass
  // attempt fails loudly instead of silently buying the base plan.
  const unknownKeys = parsed.data.addons.filter((key) => !isAddonKey(key));
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown add-on: ${unknownKeys.join(", ")}` },
      { status: 400 }
    );
  }

  const addonKeys = [...new Set(parsed.data.addons)] as AddonKey[];

  // Guards the direct-POST path; /upgrade already redirects in the UI.
  const existing = await getActiveSubscription(user.id);
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active subscription." },
      { status: 409 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    // Env var names belong in logs, not responses.
    console.error("[billing:checkout] NEXT_PUBLIC_APP_URL is not set");
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }

  try {
    const billingCustomer = await getOrCreateBillingCustomer(user);

    const basePriceId = await getPriceIdByLookupKey(BASE.lookupKey);
    const addonPriceIds = await Promise.all(
      addonKeys.map((key) => getPriceIdByLookupKey(ADDONS[key].lookupKey))
    );

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: billingCustomer.stripeCustomerId,
      line_items: [
        { price: basePriceId, quantity: 1 },
        ...addonPriceIds.map((price) => ({ price, quantity: 1 })),
      ],
      client_reference_id: user.id,
      // How the webhook maps a subscription back to a user without depending
      // on any session state.
      subscription_data: { metadata: { userId: user.id } },
      success_url: `${appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/upgrade?canceled=1`,
      allow_promotion_codes: true,
      // NOTE: Stripe Tax is intentionally not enabled. Turning it on means
      // adding automatic_tax, billing_address_collection: "required", and
      // customer_update — customer_update is MANDATORY alongside
      // automatic_tax with an existing customer or the session errors.
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Log the detail; never return it. Catalog errors embed operator
    // instructions and Stripe SDK errors carry request ids and internal state,
    // and upgrade-form.tsx renders `error` verbatim to the customer.
    console.error("[billing:checkout]", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
