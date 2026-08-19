import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { validateSiteForPublish } from "@/lib/site/publish-validation";
import { PublishForm } from "@/components/onboarding/publish-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const site = await (await api()).site.config({ siteId: siteId });
  if (!site) redirect("/builder");

  const suggestedSlug = site.site.slug.startsWith("untitled-")
    ? (await (await api()).site.suggestSlug({ name: site.site.name })) || "my-church"
    : site.site.slug;

  const preValidation = validateSiteForPublish({
    ...site,
    site: { ...site.site, slug: suggestedSlug },
  });

  return (
    <div>
      <WizardStepHeader
        title="Publish your website"
        description="Choose your web address and go live on your subdomain."
      />
      <PublishForm
        siteId={siteId}
        suggestedSlug={suggestedSlug}
        initialErrors={preValidation.errors}
      />
    </div>
  );
}
