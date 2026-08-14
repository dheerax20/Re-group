import { StepProgress } from "@/components/onboarding/step-progress";
import { requireSession } from "@/lib/auth/session";

export default async function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <div className="min-h-screen bg-background regroup-noise">
      <StepProgress />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
