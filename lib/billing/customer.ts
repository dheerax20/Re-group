import type { BillingCustomer } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStripe } from "./stripe";

/**
 * Get-or-create the Stripe customer backing a user.
 *
 * This is the one billing table written outside `sync.ts`, and deliberately
 * so: the customer must exist before Checkout can run, which is before any
 * subscription or webhook exists. `sync.ts` remains the sole writer of
 * Subscription, SubscriptionItem, and Entitlement.
 */
export async function getOrCreateBillingCustomer(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<BillingCustomer> {
  const existing = await prisma.billingCustomer.findUnique({
    where: { userId: user.id },
  });
  if (existing) return existing;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    // Lets a Stripe-side operator trace a customer back to a user, and
    // survives the temp-auth module being replaced.
    metadata: { userId: user.id },
  });

  try {
    return await prisma.billingCustomer.create({
      data: { userId: user.id, stripeCustomerId: customer.id },
    });
  } catch (error) {
    // Two concurrent checkouts can both pass the findUnique above. The unique
    // constraint on userId settles it; the loser reuses the winner's row.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.billingCustomer.findUnique({
        where: { userId: user.id },
      });
      if (raced) return raced;
    }
    throw error;
  }
}
