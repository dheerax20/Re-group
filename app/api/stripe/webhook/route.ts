import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/sync";

// Signature verification needs Node crypto, so the Edge runtime is not an option.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Note on `proxy.ts`: Next 16 buffers and clones the request body so a proxy
 * can read it twice, and any transformation would break signature
 * verification. This project's proxy returns `NextResponse.next()` for
 * everything under `/api` before touching the request, so the raw body and the
 * `stripe-signature` header arrive here intact. If that early return is ever
 * removed, exclude this path from the proxy matcher.
 */

/**
 * How long a claim may sit incomplete before another delivery may take it over.
 *
 * Must exceed the worst-case handler, or a slow-but-alive handler gets its
 * claim stolen and the event runs twice. The realistic ceiling is the Stripe
 * retrieve (Node SDK default 80s timeout) + the sync transaction's maxWait 15s
 * + timeout 30s ≈ 125s, so 2 minutes was too tight.
 */
const ABANDONED_CLAIM_MS = 5 * 60 * 1000;

const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

/**
 * Events we receive and deliberately do nothing with. Listed explicitly so the
 * decision is visible rather than incidental — anything not in either set is
 * simply unrecognised.
 *
 * `invoice_payment.*` are Dahlia-era events that post-date the original design.
 * An `invoice_payment` object references only an invoice id and carries no
 * subscription, so acting on one would mean an extra retrieve to reach state
 * that `invoice.paid` already delivers for the same payment.
 *
 * `entitlements.active_entitlement_summary.updated` is Stripe computing the
 * feature set itself. `sync.ts` derives entitlements from plan metadata and
 * stays the source of truth, so this is a cross-check we do not act on.
 */
const DELIBERATELY_IGNORED_EVENTS = new Set<string>([
  "invoice_payment.paid",
  "invoice_payment.payment_failed",
  "entitlements.active_entitlement_summary.updated",
]);

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Turns a claim into proof of completion. Until this runs, the event is replayable. */
async function markCompleted(eventId: string): Promise<void> {
  await prisma.processedStripeEvent.update({
    where: { id: eventId },
    data: { completedAt: new Date() },
  });
}

/**
 * The subscription this event concerns, or null if it concerns none.
 *
 * `invoice.subscription` does NOT exist on this API version — it lives at
 * `invoice.parent.subscription_details.subscription`. Reading the old path
 * silently yields undefined and the invoice events become no-ops.
 */
function subscriptionIdForEvent(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return null;
      return idOf(session.subscription);
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return subscription.id;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return idOf(invoice.parent?.subscription_details?.subscription);
    }

    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe:webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  // Raw string — never request.json(), which would reserialize and invalidate
  // the signature.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`[stripe:webhook] signature verification failed: ${message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Claim the event. The unique constraint on the Stripe event id is what
  // makes redelivery a no-op.
  //
  // A claim is only proof of COMPLETION once `completedAt` is set. A row with
  // a null `completedAt` is a handler that never reported back — a crash
  // between claim and completion. Treating that as "already processed" would
  // drop the event permanently, since Stripe's retry would get a 200.
  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.processedStripeEvent.findUnique({
        where: { id: event.id },
        select: { completedAt: true, processedAt: true },
      });

      if (existing?.completedAt) {
        console.log(`[stripe:webhook] ${event.id} already processed — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      const claimAgeMs = existing
        ? Date.now() - existing.processedAt.getTime()
        : Number.POSITIVE_INFINITY;

      if (claimAgeMs < ABANDONED_CLAIM_MS) {
        // Another handler is plausibly still working on it. Ask Stripe to
        // retry rather than running the same sync concurrently.
        console.warn(
          `[stripe:webhook] ${event.id} claimed ${Math.round(claimAgeMs / 1000)}s ago ` +
            `and not yet complete — asking Stripe to retry`
        );
        return NextResponse.json(
          { error: "Event still being processed" },
          { status: 409 }
        );
      }

      // Stale claim: the previous handler died. Take it over.
      //
      // upsert, not update: another handler's failure path may have deleted the
      // row between the failed create above and this write, and a bare update
      // would then throw P2025 from inside this catch block, outside any try.
      console.warn(
        `[stripe:webhook] ${event.id} has an abandoned claim — reprocessing`
      );
      await prisma.processedStripeEvent.upsert({
        where: { id: event.id },
        create: { id: event.id, type: event.type },
        update: { processedAt: new Date(), completedAt: null },
      });
    } else {
      throw error;
    }
  }

  try {
    if (!HANDLED_EVENTS.has(event.type)) {
      // Must still be 200 — a non-2xx for an unhandled type triggers endless
      // retries and eventually a disabled endpoint.
      if (!DELIBERATELY_IGNORED_EVENTS.has(event.type)) {
        // Not in either set: Stripe is sending something we have never
        // considered. Worth knowing about; still not worth failing over.
        console.log(`[stripe:webhook] unrecognized event type: ${event.type}`);
      }
      await markCompleted(event.id);
      return NextResponse.json({ received: true, ignored: event.type });
    }

    const subscriptionId = subscriptionIdForEvent(event);
    if (!subscriptionId) {
      await markCompleted(event.id);
      return NextResponse.json({ received: true, ignored: "no subscription" });
    }

    const result = await syncSubscriptionFromStripe(subscriptionId, {
      eventCreatedAt: new Date(event.created * 1000),
    });

    // A missing BillingCustomer means the work genuinely did NOT happen — the
    // row may simply not have committed yet. Marking it complete would record
    // a permanent loss, so release the claim and let Stripe retry.
    if (!result.synced && result.reason === "no_billing_customer") {
      await prisma.processedStripeEvent
        .delete({ where: { id: event.id } })
        .catch(() => undefined);

      return NextResponse.json(
        { error: "No billing customer for this subscription yet" },
        { status: 500 }
      );
    }

    await markCompleted(event.id);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    // Release the claim so Stripe's retry can genuinely reprocess this event,
    // rather than hitting the idempotency check and being dropped.
    await prisma.processedStripeEvent
      .delete({ where: { id: event.id } })
      .catch(() => undefined);

    console.error(`[stripe:webhook] handler failed for ${event.type}`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
