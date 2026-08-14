import { redirect } from "next/navigation";
import { getSite, getTemplateRecommendations, selectTemplate } from "@/lib/site/actions";
import { buildPreviewSiteConfig } from "@/lib/site/preview";
import { wizardHref } from "@/lib/onboarding/steps";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TemplatePreviewFrame } from "@/components/onboarding/template-preview-frame";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { templateRegistry } from "@/lib/templates/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TemplateRecommendation } from "@/lib/ai/types";
import type { SiteConfig } from "@/lib/site/types";

function TemplateCard({
  rec,
  config,
  featured,
  chooseTemplate,
}: {
  rec: TemplateRecommendation;
  config: SiteConfig;
  featured: boolean;
  chooseTemplate: (templateId: string) => Promise<void>;
}) {
  const template = templateRegistry[rec.templateId];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-soft)]">
      {featured ? (
        <div className="bg-accent px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-accent-foreground">
          Best match
        </div>
      ) : null}
      <ThemeProvider brand={config.brand}>
        <TemplatePreviewFrame>
          <WebsiteRenderer site={config} content={{ sermons: [], events: [] }} />
        </TemplatePreviewFrame>
      </ThemeProvider>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {template?.metadata.name}
          </h3>
          {rec.score > 0 ? <Badge variant="secondary">Score {rec.score}</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted">{template?.metadata.description}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground">
          {rec.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5">
              <span className="text-brand">✓</span> {reason}
            </li>
          ))}
        </ul>
        <form action={chooseTemplate.bind(null, rec.templateId)} className="mt-4">
          <Button type="submit" className="w-full">
            Use this design
          </Button>
        </form>
      </div>
    </div>
  );
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const site = await getSite(siteId);
  if (!site) redirect("/builder");

  const recommendations = await getTemplateRecommendations(siteId);
  const recommendedIds = new Set(recommendations.map((r) => r.templateId));
  const rest = Object.values(templateRegistry).filter((t) => !recommendedIds.has(t.id));
  const previews = await Promise.all(
    recommendations.map(async (rec) => ({
      rec,
      config: await buildPreviewSiteConfig(site, rec.templateId),
    }))
  );
  const extraPreviews = await Promise.all(
    rest.map(async (template) => ({
      rec: {
        templateId: template.id,
        score: 0,
        reasons: [template.metadata.description],
      },
      config: await buildPreviewSiteConfig(site, template.id),
    }))
  );

  async function chooseTemplate(templateId: string) {
    "use server";
    await selectTemplate(siteId!, templateId);
    redirect(wizardHref("publish", siteId!));
  }

  return (
    <div>
      <WizardStepHeader
        title={`${previews.length} AI-matched designs for ${site.site.name}`}
        description="Previews use your church story, colors, and features — cinematic templates included."
      />

      <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
        Ranked by congregation size, denomination, brand tokens, and enabled modules.
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {previews.map(({ rec, config }, i) => {
          const template = templateRegistry[rec.templateId];
          return (
            <TemplateCard
              key={rec.templateId}
              rec={rec}
              config={config}
              featured={i === 0}
              chooseTemplate={chooseTemplate}
            />
          );
        })}
      </div>

      {extraPreviews.length > 0 ? (
        <div className="mt-12">
          <h2 className="font-serif text-lg font-semibold">Full catalog</h2>
          <p className="mt-1 text-sm text-muted">Every layout still uses your brand and story.</p>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {extraPreviews.map(({ rec, config }) => (
              <TemplateCard
                key={rec.templateId}
                rec={rec}
                config={config}
                featured={false}
                chooseTemplate={chooseTemplate}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <a href={wizardHref("features", siteId)} className="text-sm text-muted hover:text-foreground">
          ← Back
        </a>
      </div>
    </div>
  );
}
