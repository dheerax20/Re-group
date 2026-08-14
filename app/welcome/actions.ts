"use server";

import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";
import { hasBasePlan } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

/**
 * Marks the post-checkout welcome finished and sends the user into the
 * website builder wizard.
 *
 * Re-checks entitlements server-side: the button lives on a page that already
 * gated, but a Server Function is its own entry point and must not trust that.
 */
export async function completeOnboarding() {
  const user = await syncCurrentUser();

  if (!(await hasBasePlan(user.id))) {
    redirect("/upgrade");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  redirect("/builder");
}
