import { api } from "@/server/trpc/caller";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  PanelsTopLeft,
  PencilRuler,
  Sparkles,
} from "lucide-react";
import { getSlackConnectionState } from "@/lib/slack/actions";
import { availableSitePages } from "@/lib/site/pages";
import { isSiteTemplateId, templateCards } from "@/lib/site/templates";
import { AI_GENERATED_TEMPLATE_ID } from "@/lib/ai/agents/schemas";
import { TemplatePicker } from "@/components/onboarding/template-picker";
import { DataList, DataListRow, RowIcon } from "@/components/layout/data-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageSections, Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Website Builder — Regroup" };

/**
 * The website, as one screen.
 *
 * Everything a church's site *is* — its status, its address, its pages, the
 * services wired to it — used to be four separate destinations in the sidebar
 * ("Site setup", "Pages & links", "Domains", "Slack"), which asked a church to
 * already know our information architecture in order to find anything. They
 * are sections of one page now, and the sidebar has one entry.
 *
 * The editor is deliberately the single filled button at the top: this page
 * manages the website, but building it happens there.
 */
function formatWhen(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function WebsiteBuilderPage() {
  const trpc = await api();
  const active = await trpc.site.mine();

  if (!active) {
    return (
      <>
        <PageHeader
          title="Website Builder"
          description="Build and manage your church website."
        />
        <EmptyState
          icon={Sparkles}
          title="You don't have a website yet"
          description="Answer a few questions about your church and we'll generate a full site for you to publish."
          action={
            <Button asChild>
              <Link href="/builder">Generate my website</Link>
            </Button>
          }
        />
      </>
    );
  }

  const [summary, domains, config, slack] = await Promise.all([
    trpc.site.summary({ siteId: active.id }),
    trpc.domains.list({ siteId: active.id }),
    trpc.site.config({ siteId: active.id }),
    getSlackConnectionState(active.id),
  ]);

  const published = summary.status === "PUBLISHED";
  const publishedAt = formatWhen(summary.publishedAt);
  const catalog = config ? availableSitePages(config.features) : [];
  const navigation = config?.navigation ?? [];
  const primaryDomain = domains.groups.find((group) => group.isPrimary) ?? domains.groups[0];

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Website Builder"
        description="Build and manage your church website from one place."
        actions={
          <>
            {published ? (
              <Button asChild variant="outline">
                <a
                  href={`https://${domains.canonicalHost}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Visit site
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/dashboard/builder">
                <PencilRuler />
                Open editor
              </Link>
            </Button>
          </>
        }
      />

      <PageSections>
        <Section title="Website" description="Where your church site stands right now.">
          <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <RowIcon tone={published ? "success" : "neutral"}>
              <PanelsTopLeft />
            </RowIcon>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {published ? domains.canonicalHost : "Not published yet"}
                </p>
                <Badge variant={published ? "success" : "warning"} dot>
                  {published ? "Published" : "Draft"}
                </Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                {published
                  ? publishedAt
                    ? `Last published ${publishedAt}.`
                    : "Anyone with the address can visit your site."
                  : "Publish from the editor when you are ready for visitors."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {published ? (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://${domains.canonicalHost}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open website
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              ) : null}
              <Button asChild size="sm">
                <Link href="/dashboard/builder">Edit website</Link>
              </Button>
            </div>
          </Card>
        </Section>

        {config ? (
          <Section
            title="Design"
            description={
              config.styleName
                ? `Your site is using ${config.styleName}. Switching rebuilds every page from your church details — instantly, and at no cost.`
                : "Pick a design and every page is rebuilt from your church details."
            }
          >
            {/*
              The same picker the onboarding wizard shows, which is what makes
              the snapshot the apply path takes safe: a template's pages are
              frozen at apply time, so re-applying is how a church picks up a
              change to their own details afterwards.
            */}
            <TemplatePicker
              siteId={active.id}
              templates={templateCards(active.id, {
                currentTemplateId: config.template.id,
                previousHeroImage: config.heroImageUrl,
              })}
              swatches={[
                config.brand.colors.primary,
                config.brand.colors.secondary,
                config.brand.colors.accent,
              ]}
              currentTemplateId={config.template.id}
              // Always confirm here. Unlike the wizard, every site reaching
              // this screen already has a design and may have edited it.
              hasDesign={
                config.template.id === AI_GENERATED_TEMPLATE_ID ||
                isSiteTemplateId(config.template.id)
              }
              aiHref={`/builder/templates?siteId=${active.id}&mode=ai`}
            />
          </Section>
        ) : null}

        <Section
          title="Pages"
          description="The pages in your navigation, in the order visitors see them."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/pages">Manage pages</Link>
            </Button>
          }
        >
          {navigation.length === 0 ? (
            <EmptyState
              compact
              icon={FileText}
              title="No pages in your menu yet"
              description="Add the pages your church wants visitors to find."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/pages">Add a page</Link>
                </Button>
              }
            />
          ) : (
            <DataList>
              {navigation.map((item) => {
                const page = catalog.find((entry) => entry.href === item.href);
                return (
                  <DataListRow
                    key={item.href}
                    leading={
                      <RowIcon>
                        <FileText />
                      </RowIcon>
                    }
                    meta={<span className="font-mono text-xs">{item.href}</span>}
                    description={page?.description}
                    title={item.label}
                  />
                );
              })}
            </DataList>
          )}
        </Section>

        <Section
          title="Connected services"
          description="What your website is wired to."
        >
          <DataList>
            <DataListRow
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/domains">Manage</Link>
                </Button>
              }
              leading={
                <RowIcon tone={primaryDomain?.status === "ACTIVE" ? "success" : "neutral"}>
                  <Globe />
                </RowIcon>
              }
              title="Domain"
              description={primaryDomain?.root ?? domains.canonicalHost}
              trailing={
                <Badge
                  dot
                  variant={
                    !domains.enabled
                      ? "secondary"
                      : primaryDomain?.status === "ACTIVE"
                        ? "success"
                        : primaryDomain
                          ? "warning"
                          : "secondary"
                  }
                >
                  {!domains.enabled
                    ? "Unavailable"
                    : primaryDomain?.status === "ACTIVE"
                      ? "Connected"
                      : primaryDomain
                        ? "Pending"
                        : "Regroup address"}
                </Badge>
              }
            />
            <DataListRow
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/slack">
                    {slack.connected ? "Manage" : "Connect"}
                  </Link>
                </Button>
              }
              leading={
                <RowIcon tone={slack.connected ? "success" : "neutral"}>
                  <MessageSquare />
                </RowIcon>
              }
              title="Slack"
              description={
                slack.connected
                  ? (slack.teamName ?? "Workspace connected")
                  : "Edit your website from a Slack channel"
              }
              trailing={
                <Badge
                  dot
                  variant={
                    !slack.enabled
                      ? "secondary"
                      : slack.connected
                        ? slack.needsRebind
                          ? "warning"
                          : "success"
                        : "secondary"
                  }
                >
                  {!slack.enabled
                    ? "Unavailable"
                    : slack.connected
                      ? slack.needsRebind
                        ? "Needs attention"
                        : "Connected"
                      : "Not connected"}
                </Badge>
              }
            />
          </DataList>
        </Section>
      </PageSections>
    </>
  );
}
