import { NextResponse, type NextRequest } from "next/server";
import {
  PRORATION_DATE_MAX_AGE_SECONDS,
  STRIPE_MINIMUM_CHARGE,
  buildItems,
  dropAlreadyAppliedChanges,
  idempotencyKeyFor,
  isContextError,
  parseChanges,
  pendingChanges,
  resolveContext,
  sumProrationLines,
} from "@/lib/billing/addons";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/**
 * Applies add-on changes to the caller's own subscription.
 *
 * Deliberately does NOT write entitlements. The `customer.subscription.updated`
 * webhook calls sync.ts, which stays the single writer — flipping entitlements
 * here would diverge from Stripe the moment a payment fails.
 */
export async function PATCH(request: NextRequest) {
  const context = await resolveContext();
  if (isContextError(context)) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as { changes?: unknown; prorationDate?: unknown };

  const parsed = parseChanges(body.changes);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (typeof body.prorationDate !== "number" || !Number.isFinite(body.prorationDate)) {
    return NextResponse.json(
      { error: "prorationDate is required — request a preview first" },
      { status: 400 }
    );
  }

  const prorationDate = Math.floor(body.prorationDate);
  const ageSeconds = Math.floor(Date.now() / 1000) - prorationDate;

  // A stale quote means Stripe would compute a different proration than the
  // one shown. Force a re-preview rather than charge an unquoted amount.
  if (ageSeconds > PRORATION_DATE_MAX_AGE_SECONDS || ageSeconds < -60) {
    return NextResponse.json(
      { error: "This quote has expired. Please review the changes again.", stale: true },
      { status: 409 }
    );
  }

  const { subscription } = context;
  const fromLocalState = pendingChanges(subscription, parsed.changes);

  if (fromLocalState.length === 0) {
    return NextResponse.json({ updated: false, noop: true });
  }

  try {
    const stripe = getStripe();

    // Re-check against LIVE Stripe state before spending money. Our database
    // can legitimately be behind (webhook in flight), and acting on that stale
    // view is what appends a second paid item for an add-on the customer
    // already has.
    const { effective, skipped } = await dropAlreadyAppliedChanges(
      subscription.stripeSubscriptionId,
      fromLocalState
    );

    if (skipped.length > 0) {
      console.warn(
        `[billing:addons] ignoring ${skipped.length} already-applied change(s) on ` +
          `${subscription.stripeSubscriptionId}: ` +
          skipped.map((c) => `${c.addon}=${c.enabled}`).join(", ")
      );
    }

    if (effective.length === 0) {
      // Everything requested is already true of the subscription. Report
      // success — the customer's intent is satisfied — but charge nothing.
      return NextResponse.json({
        updated: false,
        noop: true,
        alreadyApplied: true,
        pendingWebhook: true,
      });
    }

    const changes = effective;
    const items = await buildItems(subscription, changes);
    const isAdding = changes.some((change) => change.enabled);

    // Re-quote at the SAME proration date to decide the billing behaviour.
    // Below Stripe's minimum charge, always_invoice fails outright.
    let prorationBehavior: "always_invoice" | "create_prorations" = isAdding
      ? "always_invoice"
      : "create_prorations";
    let deferredToNextInvoice = !isAdding;

    if (prorationBehavior === "always_invoice") {
      const preview = await stripe.invoices.createPreview({
        subscription: subscription.stripeSubscriptionId,
        subscription_details: { items, proration_date: prorationDate },
      });

      if (sumProrationLines(preview) < STRIPE_MINIMUM_CHARGE) {
        prorationBehavior = "create_prorations";
        deferredToNextInvoice = true;
      }
    }

    await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items,
        proration_behavior: prorationBehavior,
        proration_date: prorationDate,
        // Surfaces a declined card as an error instead of leaving the
        // subscription stuck in `incomplete`.
        payment_behavior: "error_if_incomplete",
      },
      {
        idempotencyKey: idempotencyKeyFor(
          subscription.stripeSubscriptionId,
          changes,
          prorationDate
        ),
      }
    );

    return NextResponse.json({
      updated: true,
      deferredToNextInvoice,
      // Entitlements follow via the webhook, usually within a second or two.
      pendingWebhook: true,
    });
  } catch (error) {
    console.error("[billing:addons:patch]", error);

    /**
     * A declined card is the one case where Stripe's own message is both safe
     * and genuinely useful to the customer ("Your card was declined.",
     * "Insufficient funds."). Everything else is logged and replaced with a
     * generic string — catalog errors embed operator instructions and SDK
     * errors carry request ids, and the client renders this verbatim.
     */
    const stripeError = error as { type?: string; message?: string };
    if (stripeError?.type === "StripeCardError") {
      return NextResponse.json(
        { error: stripeError.message ?? "Your card was declined." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "Could not apply these changes. Please try again." },
      { status: 500 }
    );
  }
}
