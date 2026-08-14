import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";

/**
 * The paywall for the authenticated app.
 *
 * `(paid)` is a route group, so it adds nothing to any URL — /dashboard is
 * still /dashboard. It exists purely to draw a line inside `(app)`: everything
 * under here needs a live base plan, while `app/(app)/settings/billing` sits
 * deliberately OUTSIDE it. That is what stops a past_due user from being
 * redirected to billing by the very layout that renders billing.
 */
export default async function PaidLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await syncCurrentUser();
  await requireActivePlan(user.id);

  return <>{children}</>;
}
