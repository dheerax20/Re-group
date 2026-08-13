import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-temp";
import { hasBasePlan, listEntitlements } from "@/lib/billing/entitlements";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "./actions";
import { FinalizingSubscription } from "./finalizing";

export const metadata = {
  title: "Welcome — Regroup",
  description: "Your subscription is ready.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser();
  const { session_id: sessionId } = await searchParams;

  // Entitlements come from the database, never from session_id — that is a
  // redirect parameter, not proof of payment.
  const ready = await hasBasePlan(user.id);

  if (!ready) {
    // No payment in flight at all: nothing to wait for.
    if (!sessionId) redirect("/upgrade");

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <FinalizingSubscription sessionId={sessionId} />
      </main>
    );
  }

  const entitlements = await listEntitlements(user.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          You&rsquo;re all set
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your subscription is active. Next, let&rsquo;s build your church
          website.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Included
          </p>
          <ul className="mt-2 space-y-1">
            {entitlements.map((entitlement) => (
              <li key={entitlement.id} className="text-sm text-foreground">
                {entitlement.featureKey}
              </li>
            ))}
          </ul>
        </div>

        <form action={completeOnboarding}>
          <Button
            type="submit"
            className="mt-6 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Start building your site
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Manage your plan any time in{" "}
          <a href="/settings/billing" className="underline">
            billing settings
          </a>
          .
        </p>
      </div>
    </main>
  );
}
