"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-temp";
import { hasBasePlan } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

/**
 * Marks onboarding finished and sends the user into the website builder.
 *
 * Re-checks entitlements server-side: the button lives on a page that already
 * gated, but a Server Function is its own entry point and must not trust that.
 */
export async function completeOnboarding() {
  const user = await requireUser();

  if (!(await hasBasePlan(user.id))) {
    redirect("/upgrade");
  }

  await prisma.tempUser.update({
    where: { id: user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  redirect("/builder");
}
