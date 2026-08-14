import { notFound } from "next/navigation";
import Link from "next/link";
import { getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TemplatePreviewFrame } from "@/components/onboarding/template-preview-frame";
import { PublishBar } from "@/components/builder/publish-bar";
import { builderHref } from "@/lib/builder/nav";
import { Calendar, Mic2, Video, LayoutDashboard, PanelsTopLeft } from "lucide-react";

const contentLinks = [
  {
    path: "events",
    label: "Events",
    description: "Add gatherings — they appear on your live site.",
    icon: Calendar,
  },
  {
    path: "sermons",
    label: "Sermons",
    description: "Publish messages to the sermons section.",
    icon: Mic2,
  },
  {
    path: "youtube",
    label: "YouTube",
    description: "Connect your channel for media embeds.",
    icon: Video,
  },
];

export default async function BuilderOverviewPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  const content = await getSiteContent(siteId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Website
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {site.site.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage events, sermons, and YouTube — content syncs to your public site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/builder?siteId=${siteId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-background"
          >
            <PanelsTopLeft className="h-4 w-4" />
            Open editor
          </Link>
          <Link
            href={`/dashboard?siteId=${siteId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-background"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <PublishBar siteId={siteId} slug={site.site.slug} status={site.site.status} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {contentLinks.map((item) => (
          <Link
            key={item.path}
            href={builderHref(siteId, item.path)}
            className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/30"
          >
            <item.icon className="h-5 w-5 text-brand" />
            <p className="mt-3 font-semibold text-foreground">{item.label}</p>
            <p className="mt-1 text-sm text-muted">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Live preview</h2>
          <p className="text-xs text-muted">
            {content.events.length} events · {content.sermons.length} sermons
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs text-muted">Website preview</span>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              {site.site.status}
            </span>
          </div>
          <ThemeProvider brand={site.brand}>
            <TemplatePreviewFrame>
              <WebsiteRenderer site={site} content={content} />
            </TemplatePreviewFrame>
          </ThemeProvider>
        </div>
      </div>
    </div>
  );
}
