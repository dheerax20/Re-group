import { NextResponse, type NextRequest } from "next/server";
import {
  buildItems,
  isContextError,
  parseChanges,
  pendingChanges,
  resolveContext,
  sumProrationLines,
} from "@/lib/billing/addons";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/**
 * Quotes the exact amount charged today for a set of add-on changes.
 *
 * The returned `prorationDate` MUST be echoed back to PATCH /api/billing/addons
 * — passing the same date to both preview and update is the only way the quote
 * and the charge match exactly.
 */
export async function POST(request: NextRequest) {
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

  const parsed = parseChanges((raw as { changes?: unknown })?.changes);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { subscription } = context;
  const changes = pendingChanges(subscription, parsed.changes);

  if (changes.length === 0) {
    return NextResponse.json({
      dueToday: 0,
      prorationDate: Math.floor(Date.now() / 1000),
      currency: "usd",
      noop: true,
    });
  }

  try {
    const prorationDate = Math.floor(Date.now() / 1000);
    const items = await buildItems(subscription, changes);

    const preview = await getStripe().invoices.createPreview({
      subscription: subscription.stripeSubscriptionId,
      subscription_details: { items, proration_date: prorationDate },
    });

    const dueToday = sumProrationLines(preview);

    return NextResponse.json({
      dueToday,
      prorationDate,
      currency: preview.currency,
      noop: false,
    });
  } catch (error) {
    console.error("[billing:addons:preview]", error);
    return NextResponse.json(
      { error: "Could not price these changes. Please try again." },
      { status: 500 }
    );
  }
}
