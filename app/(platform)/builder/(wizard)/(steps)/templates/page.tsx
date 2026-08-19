import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import Link from "next/link";
import { wizardHref } from "@/lib/onboarding/steps";
import { WizardStepHeader } from "@/components/onboarding/wizard-step-header";
import { AiWebsiteStudio } from "@/components/onboarding/ai-website-studio";
import { RebuildButton } from "@/components/onboarding/rebuild-button";
import { GenerationPreview } from "@/components/onboarding/generation-preview";
import { Button } from "@/components/ui/button";
import { AI_GENERATED_TEMPLATE_ID } from "@/lib/ai/agents/schemas";
import { sectionTypeLabels } from "@/lib/site/section-variants";
import { Camera, ImagePlus, Smartphone, Sparkles, Video } from "lucide-react";

export const maxDuration = 180;

const ACTION_HINT: Record<string, string> = {
  upload_hero_photo: "Add your sanctuary / worship photo in the website editor",
  add_welcome_video: "Add a welcome video URL in the editor",
  connect_youtube: "Connect YouTube in the dashboard",
  add_event_photos: "Add photos to upcoming events",
  upload_logo: "Upload your logo in Brand",
  add_sermon_video: "Attach video to sermons",
  fix_mobile_hero: "Check hero crop on phone in the editor",
  fix_mobile_nav: "Test the mobile menu on a phone",
  tighten_mobile_type: "Shorten headlines for small screens",
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) redirect("/builder");

  const trpc = await api();
  const site = await trpc.site.config({ siteId });
  if (!site) redirect("/builder");

  // A build in flight wins over an already-built site: after "Regenerate", the
  // previous design is still in the database, so checking only for content
  // would show the old website instead of the running build.
  const status = await trpc.ai.buildStatus({ siteId });
  const job = status?.job ?? null;
  const building = job?.status === "QUEUED" || job?.status === "RUNNING";
  // The crew writes a block tree now; a site built before that still only has
  // sections, so either one counts as "there is a design here".
  const ready =
    !building &&
    site.template.id === AI_GENERATED_TEMPLATE_ID &&
    (site.blocks.length > 0 || site.sections.length > 0);
  const improvements = site.improvements ?? [];
  const designFeedback = site.designFeedback ?? [];
  const mobileFeedback = site.mobileFeedback ?? [];
  const agentLog = site.agentLog ?? [];
  const styleName = site.styleName;

  async function acceptWebsite() {
    "use server";
    redirect(wizardHref("publish", siteId!));
  }

  return (
    <div>
      <WizardStepHeader
        title={
          ready
            ? `${site.site.name}${styleName ? ` · ${styleName}` : ""}`
            : `Designing ${site.site.name}`
        }
        description={
          ready
            ? "AI built layout and copy. Add your church photos before you publish."
            : "LangChain crew invents layout + copy. You’ll provide photos next."
        }
      />

      {!ready ? (
        <AiWebsiteStudio
          siteId={siteId}
          initialJob={job}
          initialToken={status?.publicAccessToken ?? null}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {site.sections
              .filter((section) => section.enabled)
              .map((section) => (
                <span
                  key={section.id}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium"
                >
                  {sectionTypeLabels[section.type] ?? section.type}
                  {section.variant ? (
                    <span className="text-muted"> · {section.variant}</span>
                  ) : null}
                </span>
              ))}
          </div>

          <div className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <Camera className="size-4" />
              </span>
              <div>
                <h2 className="font-semibold tracking-tight">Provide your images</h2>
                <p className="mt-1 text-sm text-muted">
                  Hero, welcome, about, and CTA photo slots are empty on purpose. Open the editor and
                  paste image URLs (or upload later) so the site uses your real church photos.
                </p>
                <div className="mt-3">
                  <Link href="/dashboard/builder">
                    <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
                      Add photos in editor
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <GenerationPreview site={site} />

          {(mobileFeedback.length > 0 || designFeedback.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {mobileFeedback.length > 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-brand" />
                    <h2 className="font-semibold">Mobile improvements</h2>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {mobileFeedback.map((item) => (
                      <li
                        key={`m-${item.title}`}
                        className="rounded-xl border border-border bg-background px-3 py-2.5"
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {designFeedback.length > 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-accent" />
                    <h2 className="font-semibold">Design feedback</h2>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {designFeedback.map((item) => (
                      <li
                        key={`d-${item.title}`}
                        className="rounded-xl border border-border bg-background px-3 py-2.5"
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">
                          {item.area}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {improvements.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <ImagePlus className="size-4" />
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">Photo & media checklist</h2>
                  <p className="mt-1 text-sm text-muted">
                    Provide these from your church — no AI-generated images for now.
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {improvements.map((item) => (
                  <li
                    key={`${item.action}-${item.title}`}
                    className="rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      {item.action.includes("video") || item.action.includes("youtube") ? (
                        <Video className="mt-0.5 size-4 shrink-0 text-brand" />
                      ) : (
                        <Camera className="mt-0.5 size-4 shrink-0 text-brand" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                        <p className="mt-1 text-[11px] font-medium text-brand">
                          {ACTION_HINT[item.action] ?? "Open website editor"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link href="/dashboard/builder">
                  <Button variant="outline" size="sm">
                    Open editor
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {agentLog.length > 0 ? (
            <details className="rounded-2xl border border-border bg-background px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Agent run log</summary>
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {agentLog.map((entry) => (
                  <li key={`${entry.agent}-${entry.summary}`} className="text-xs text-muted">
                    <span className="font-medium text-foreground">{entry.role}</span>
                    {" — "}
                    {entry.summary}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <form action={acceptWebsite} className="sm:flex-1">
              <Button type="submit" className="w-full">
                Use this website
              </Button>
            </form>
            <RebuildButton siteId={siteId} />
          </div>

          <Link
            href={wizardHref("features", siteId)}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Back to features
          </Link>
        </div>
      )}
    </div>
  );
}
