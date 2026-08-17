import { StepProgress } from "@/components/onboarding/step-progress";
import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";

export default async function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The wizard lives in `(platform)`, outside the `(paid)` group, so it needs
  // its own paywall — deep-linking a step must not skip the gate.
  const user = await syncCurrentUser();
  await requireActivePlan(user.id);
  return (
    <div className="min-h-screen bg-background regroup-noise">
      <StepProgress />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
