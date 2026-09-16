import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { BrandForm } from "@/components/onboarding/brand-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { TemplatePicker } from "@/components/onboarding/template-picker";
import { FieldGroup } from "@/components/onboarding/form-primitives";
import { wizardHref } from "@/lib/onboarding/steps";
import { AI_GENERATED_TEMPLATE_ID } from "@/lib/ai/agents/schemas";
import { isSiteTemplateId, templateCards } from "@/lib/site/templates";

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const site = await (await api()).site.config({ siteId: siteId });
  if (!site) redirect("/builder");

  const isAiDesign = site.template.id === AI_GENERATED_TEMPLATE_ID;
  const hasDesign = isAiDesign || isSiteTemplateId(site.template.id);
  const ready = hasDesign && (site.blocks.length > 0 || site.sections.length > 0);

  return (
    <div>
      <WizardStepHeader
        title="Your brand canvas"
        description="Colors, fonts, and logo — this is what makes your site feel like you. Pick a design below, or generate one with AI."
      />

      <FieldGroup
        title="Choose a design"
        description="Pick one and every page fills in from your church details instantly, with no AI. Or have the crew invent one."
        className="mb-6"
      >
        <TemplatePicker
          siteId={siteId}
          templates={templateCards(siteId, {
            currentTemplateId: site.template.id,
            previousHeroImage: site.heroImageUrl,
          })}
          swatches={[site.brand.colors.primary, site.brand.colors.secondary, site.brand.colors.accent]}
          currentTemplateId={site.template.id}
          hasDesign={ready}
          aiHref={`${wizardHref("templates", siteId)}&mode=ai`}
        />
      </FieldGroup>

      <BrandForm
        siteId={siteId}
        defaultValues={site.brand}
        churchName={site.site.name}
        backHref={wizardHref("features", siteId)}
        nextHref={ready ? wizardHref("publish", siteId) : wizardHref("templates", siteId)}
      />
    </div>
  );
}
