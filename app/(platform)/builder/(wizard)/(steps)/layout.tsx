import { StepProgress } from "@/components/onboarding/step-progress";
import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";
import { TrpcProvider } from "@/lib/trpc/client";
import { ToastProvider } from "@/components/ui/toast";
import { BlueprintGrid } from "@/components/onboarding/wizard-art";

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
    <TrpcProvider>
      {/*
        The wizard is in `(platform)`, not `(app)`, so it does not inherit the
        shell's toaster. `useToast()` is a deliberate no-op outside a provider
        (see `components/ui/toast.tsx`), which meant a wizard toast was not a
        broken toast — it was a silent one, and that is worse.
      */}
      <ToastProvider>
        <div className="relative min-h-screen overflow-hidden bg-background regroup-noise">
          <BlueprintGrid className="text-border opacity-60" />

          <div className="relative">
            <StepProgress
              userEmail={user.email}
              userName={user.name}
              userPicture={user.picture}
            />
            <main className="mx-auto max-w-5xl px-6 py-10">
              <div className="relative overflow-hidden rounded-panel border border-border bg-surface/95 p-6 shadow-[var(--shadow-lift)] backdrop-blur-sm sm:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </TrpcProvider>
  );
}
