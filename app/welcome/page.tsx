import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";
import { hasBasePlan } from "@/lib/billing/entitlements";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "./actions";
import { FinalizingSubscription } from "./finalizing";
import { WelcomeSuccess } from "./success";

export const metadata = {
  title: "Welcome — Regroup",
  description: "Your subscription is ready.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await syncCurrentUser();
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/*
        The heading and the animation live in `WelcomeSuccess`; the form stays
        here so `completeOnboarding` is passed as a Server Function from the
        server, not imported into the client bundle.
      */}
      <WelcomeSuccess>
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
      </WelcomeSuccess>
    </main>
  );
}
