import { StepProgress } from "@/components/onboarding/step-progress";

export default function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      <StepProgress />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
