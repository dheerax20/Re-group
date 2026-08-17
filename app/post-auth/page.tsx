import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";

/**
 * The single fork every authenticated session passes through.
 *
 * Order matters: the plan check comes first, because a user without a paid
 * base plan has nothing to see in the builder or the dashboard. Only once
 * they are entitled do we care whether they have built a site yet.
 */
export default async function PostAuthPage() {
  const user = await syncCurrentUser();

  // Redirects to /upgrade, or to /settings/billing if a payment has failed.
  await requireActivePlan(user.id);

  if (user.site) {
    redirect("/dashboard");
  }
  redirect("/builder");
}
