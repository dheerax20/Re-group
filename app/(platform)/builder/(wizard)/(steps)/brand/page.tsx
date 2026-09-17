import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandForm } from "@/components/onboarding/brand-form";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { TemplatePicker } from "@/components/onboarding/template-picker";
import { wizardHref } from "@/lib/onboarding/steps";
import { isSiteTemplateId, templateCards } from "@/lib/site/templates";
import { AI_GENERATED_TEMPLATE_ID } from "@/lib/ai/agents/schemas";

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const trpc = await api();
  const site = await trpc.site.config({ siteId: siteId });
  if (!site) redirect("/builder");

  /**
   * A build in flight wins over whatever is currently stored. Without this the
   * picker would offer to apply a template over a running build: `templateId`
   * is still unset mid-build, so `hasDesign` was false, the confirm dialog was
   * skipped, and a single click raced `commitBuild` for the same `blockConfig`
   * — discarding a build the church had already spent a monthly credit on.
   */
  const status = await trpc.ai.buildStatus({ siteId });
  const job = status?.job ?? null;
  const building = job?.status === "QUEUED" || job?.status === "RUNNING";

  /**
   * Gates the "Continue with template" exit — and it is `isSiteTemplateId`
   * rather than "has any design at all" on purpose. A site whose pages came
   * from an earlier AI build has a design, but it has not had a TEMPLATE
   * chosen, and this step's template exit is the one that skips the AI step
   * entirely. Letting a previous build satisfy it would walk the church past
   * the design decision without them making one.
   */
  const hasTemplate = isSiteTemplateId(site.template.id);

  /**
   * Whether applying would overwrite something, which is what the picker's
   * confirm dialog is for. Deliberately BROADER than `hasTemplate`: pages the
   * crew built are just as much a thing to lose as pages a template built, and
   * gating the dialog on `hasTemplate` alone would let one click quietly
   * discard an AI build the church had paid for.
   */
  const isAiDesign = site.template.id === AI_GENERATED_TEMPLATE_ID;
  const hasDesign =
    !building &&
    (isAiDesign || hasTemplate) &&
    (site.blocks.length > 0 || site.sections.length > 0);

  return (
    <div>
      <WizardStepHeader
        title="Your brand canvas"
        description="Colors, fonts, and logo — this is what makes your site feel like you. Then pick a design at the bottom, or let the crew invent one."
      />

      <BrandForm
        siteId={siteId}
        defaultValues={site.brand}
        churchName={site.site.name}
        backHref={wizardHref("features", siteId)}
        designFork={{
          hasTemplate,
          templateHref: wizardHref("publish", siteId),
          aiHref: `${wizardHref("templates", siteId)}&mode=ai`,
          picker: building ? (
            /*
              No picker while a build runs — applying a template would overwrite
              the very pages the build is writing, which the church has already
              paid a monthly build for.
            */
            <p className="text-sm text-muted">
              The crew is building your website right now, so designs are locked until it
              finishes.{" "}
              <Link
                href={wizardHref("templates", siteId)}
                className="font-medium text-brand hover:underline"
              >
                Watch the build
              </Link>
              , then pick a different design from there if you want one.
            </p>
          ) : (
            <TemplatePicker
              siteId={siteId}
              templates={templateCards(siteId, {
                currentTemplateId: site.template.id,
                previousHeroImage: site.heroImageUrl,
              })}
              swatches={[
                site.brand.colors.primary,
                site.brand.colors.secondary,
                site.brand.colors.accent,
              ]}
              currentTemplateId={site.template.id}
              hasDesign={hasDesign}
            />
          ),
        }}
      />
    </div>
  );
}
