import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import Link from "next/link";
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

  const trpc = await api();
  const site = await trpc.site.config({ siteId: siteId });
  if (!site) redirect("/builder");

  /**
   * A build in flight wins over whatever is currently stored, exactly as the
   * Design step decides it. Without this the picker here would offer to apply
   * a template over a running build: `templateId` is still unset mid-build, so
   * `hasDesign` was false, the confirm dialog was skipped, and a single click
   * raced `commitBuild` for the same `blockConfig` — discarding a build the
   * church had already spent a monthly credit on.
   */
  const status = await trpc.ai.buildStatus({ siteId });
  const job = status?.job ?? null;
  const building = job?.status === "QUEUED" || job?.status === "RUNNING";

  const isAiDesign = site.template.id === AI_GENERATED_TEMPLATE_ID;
  const hasDesign = isAiDesign || isSiteTemplateId(site.template.id);
  const ready = !building && hasDesign && (site.blocks.length > 0 || site.sections.length > 0);

  return (
    <div>
      <WizardStepHeader
        title="Your brand canvas"
        description="Colors, fonts, and logo — this is what makes your site feel like you. Pick a design below, or generate one with AI."
      />

      <FieldGroup
        title="Choose a design"
        description={
          building
            ? "The crew is building your website right now."
            : "Pick one and every page fills in from your church details instantly, with no AI. Or have the crew invent one."
        }
        className="mb-6"
      >
        {/*
          No picker while a build runs. Applying a template would overwrite the
          very pages the build is writing, and the church has already paid a
          monthly build for them.
        */}
        {building ? (
          <p className="text-sm text-muted">
            Designs are locked until it finishes.{" "}
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
            hasDesign={ready}
            aiHref={`${wizardHref("templates", siteId)}&mode=ai`}
          />
        )}
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
