import { redirect } from "next/navigation";
import { getSite } from "@/lib/site/actions";
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

  const site = await getSite(siteId);
  if (!site) redirect("/builder");

  return (
    <div>
      <WizardStepHeader
        title="Tell us about your church"
        description="This information appears throughout your site and helps us recommend the right design."
      />
      <ChurchForm siteId={siteId} defaultValues={site} nextHref={wizardHref("social", siteId)} />
    </div>
  );
}
