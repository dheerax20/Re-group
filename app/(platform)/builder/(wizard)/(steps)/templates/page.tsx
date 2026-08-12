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
  const previews = await Promise.all(
    recommendations.map(async (rec) => ({
      rec,
      config: await buildPreviewSiteConfig(site, rec.templateId),
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
        description="Previews use your real logo, colors, fonts, tagline, and enabled features — no stock screenshots."
      />

      <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
        Ranked by congregation size, denomination, brand tokens, and enabled modules.
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {previews.map(({ rec, config }, i) => {
          const template = templateRegistry[rec.templateId];
          return (
            <div
              key={rec.templateId}
              className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-soft)]"
            >
              {i === 0 ? (
                <div className="bg-foreground px-4 py-2 text-center text-xs font-medium text-background">
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
                  <h3 className="font-semibold text-foreground">{template?.metadata.name}</h3>
                  <Badge variant="secondary">Score {rec.score}</Badge>
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
        })}
      </div>

      <div className="mt-8">
        <a href={wizardHref("features", siteId)} className="text-sm text-muted hover:text-foreground">
          ← Back
        </a>
      </div>
    </div>
  );
}
