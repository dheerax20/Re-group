import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/**
 * Opens a Stripe Customer Portal session.
 *
 * This is the recovery path for a failed renewal: entitlements are revoked at
 * `past_due`, but the customer still needs somewhere to update their card. The
 * portal also owns invoice history and cancellation.
 *
 * It deliberately does NOT own add-on changes — the portal cannot update a
 * subscription with multiple products, which ours has whenever an add-on is
 * enabled. That lives in /settings/billing.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Resolved from the authenticated user, never from the request body.
  const billingCustomer = await prisma.billingCustomer.findUnique({
    where: { userId: user.id },
  });

  if (!billingCustomer) {
    return NextResponse.json(
      { error: "No billing account yet" },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: billingCustomer.stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing:portal]", error);

    // The operator instruction ("run the bootstrap script") belongs in the log,
    // not in the response. This route is the recovery path for a past_due
    // customer, so the person reading this message is the one who can act on it
    // least — and manage-billing-button.tsx renders it verbatim.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("configuration")) {
      console.error(
        "[billing:portal] no default Customer Portal configuration — " +
          "run `npm run stripe:bootstrap` or configure it in the Stripe Dashboard"
      );
      return NextResponse.json(
        {
          error:
            "Billing management is temporarily unavailable. Please contact support.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Could not open the billing portal. Please try again." },
      { status: 500 }
    );
  }
}
