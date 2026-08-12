import { redirect } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { FeaturesForm } from "@/components/onboarding/features-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { wizardHref } from "@/lib/onboarding/steps";

export default async function FeaturesPage({
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
        title="What features do you need?"
        description="These answers control what shows up on your generated website."
      />
      <FeaturesForm
        siteId={siteId}
        defaultValues={site.features}
        backHref={wizardHref("brand", siteId)}
        nextHref={wizardHref("templates", siteId)}
      />
    </div>
  );
}
