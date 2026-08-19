import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { ChurchForm } from "@/components/onboarding/church-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { wizardHref } from "@/lib/onboarding/steps";

export default async function ChurchInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const site = await (await api()).site.config({ siteId: siteId });
  if (!site) redirect("/builder");

  return (
    <div>
      <WizardStepHeader
        title="Tell us about your church"
        description="This information appears throughout your site and gives AI the details it needs to write real copy."
      />
      <ChurchForm siteId={siteId} defaultValues={site} nextHref={wizardHref("social", siteId)} />
    </div>
  );
}
