import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { SocialForm } from "@/components/onboarding/social-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { wizardHref } from "@/lib/onboarding/steps";

export default async function SocialPage({
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
        title="Social media"
        description="Add any links you have — you can leave these blank and update later."
      />
      <SocialForm
        siteId={siteId}
        defaultValues={site.socialLinks}
        backHref={wizardHref("church", siteId)}
        nextHref={wizardHref("brand", siteId)}
      />
    </div>
  );
}
