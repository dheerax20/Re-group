import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { BrandForm } from "@/components/onboarding/brand-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { wizardHref } from "@/lib/onboarding/steps";

export default async function BrandPage({
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
        title="Your brand canvas"
        description="Colors, fonts, and logo — this is what makes your site feel like you."
      />
      <BrandForm
        siteId={siteId}
        defaultValues={site.brand}
        churchName={site.site.name}
        backHref={wizardHref("social", siteId)}
        nextHref={wizardHref("features", siteId)}
      />
    </div>
  );
}
