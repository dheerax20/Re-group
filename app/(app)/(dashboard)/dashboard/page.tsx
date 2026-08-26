import { api } from "@/server/trpc/caller";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mic2,
  PanelsTopLeft,
  PencilRuler,
  Sparkles,
} from "lucide-react";
import { syncCurrentUser } from "@/lib/auth/session";
import { DataList, DataListRow, RowIcon } from "@/components/layout/data-list";
import { EmptyState } from "@/components/layout/empty-state";
import { Greeting } from "@/components/layout/greeting";
import { PageSections, Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Overview — Regroup" };

function formatEventDate(value: string | Date): string {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(value: Date): string {
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * "Still to come", read at module scope rather than in the component body:
 * reading the clock during render is impure, and React's lint rules are right
 * to say so even in a Server Component that renders once.
 */
function stillUpcoming<T extends { startAt: Date }>(events: T[], limit: number): T[] {
  const now = Date.now();
  return events.filter((event) => event.startAt.getTime() >= now).slice(0, limit);
}

/**
 * The first screen, and the one that answers a single question: how is my
 * church website doing?
 *
 * Everything on it is real. The old dashboard's temptation — and the reason
 * most church admin tools feel like a CRM — is to fill the space with numbers
 * nobody acts on. There are exactly three things here: the site's status, what
 * is coming up, and what changed recently.
 */
export default async function DashboardPage() {
  const trpc = await api();
  const [user, active] = await Promise.all([syncCurrentUser(), trpc.site.mine()]);

  if (!active) {
    return (
      <>
        <div className="pb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
            <Greeting name={user.name} />
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Let&rsquo;s get your church online.
          </p>
        </div>
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

  const [summary, domains, events, sermons] = await Promise.all([
    trpc.site.summary({ siteId: active.id }),
    trpc.domains.list({ siteId: active.id }),
    trpc.content.listEvents({ siteId: active.id }),
    trpc.content.listSermons({ siteId: active.id }),
  ]);

  const published = summary.status === "PUBLISHED";
  const upcoming = stillUpcoming(events ?? [], 4);

  /**
   * Recent activity, assembled from what actually happened rather than from an
   * events table we do not keep: the publish timestamp, and the newest row in
   * each content type. Three entries maximum — a feed nobody reads is worse
   * than no feed.
   */
  const activity = [
    published && summary.publishedAt
      ? {
          key: "published",
          icon: CheckCircle2,
          title: "Website published",
          when: summary.publishedAt,
        }
      : null,
    ...(events ?? [])
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 1)
      .map((event) => ({
        key: `event-${event.id}`,
        icon: Calendar,
        title: `Event added — ${event.title}`,
        when: event.createdAt,
      })),
    ...(sermons ?? [])
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 1)
      .map((sermon) => ({
        key: `sermon-${sermon.id}`,
        icon: Mic2,
        title: `Sermon added — ${sermon.title}`,
        when: sermon.createdAt,
      })),
  ]
    .filter((entry) => entry !== null)
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 3);

  const shortcuts = [
    {
      href: "/events",
      label: "Events",
      icon: Calendar,
      count: summary.counts.events,
      hint: "on your public calendar",
    },
    {
      href: "/sermons",
      label: "Sermons",
      icon: Mic2,
      count: summary.counts.sermons,
      hint: "in your library",
    },
    {
      href: "/dashboard/pages",
      label: "Pages",
      icon: FileText,
      count: summary.counts.pages,
      hint: "on your website",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
            <Greeting name={user.name} />
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Here&rsquo;s what&rsquo;s happening with {active.name}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        </div>
      </div>

      <PageSections>
        <Section title="Website">
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
                  ? "Anyone with the address can visit your site."
                  : "Publish from the editor when you are ready for visitors."}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/website">Website Builder</Link>
            </Button>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {shortcuts.map((item) => (
              <Link className="group" href={item.href} key={item.href}>
                <Card
                  interactive
                  className="flex h-full items-center justify-between gap-3"
                  padding="sm"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <item.icon className="size-4 text-muted" />
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">
                      <span className="tabular font-medium text-foreground">
                        {item.count}
                      </span>{" "}
                      {item.hint}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Card>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="Upcoming events"
          description="New events publish to your live site automatically."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/events">View events</Link>
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarPlus}
              title="Nothing on the calendar"
              description="Add your Sunday service or the next church gathering."
              action={
                <Button asChild size="sm">
                  <Link href="/events">Add an event</Link>
                </Button>
              }
            />
          ) : (
            <DataList>
              {upcoming.map((event) => (
                <DataListRow
                  key={event.id}
                  leading={
                    <RowIcon>
                      <Calendar />
                    </RowIcon>
                  }
                  meta={
                    <span className="tabular">
                      {formatEventDate(event.startAt)}
                      {event.location ? ` · ${event.location}` : ""}
                    </span>
                  }
                  title={event.title}
                />
              ))}
            </DataList>
          )}
        </Section>

        {activity.length > 0 ? (
          <Section title="Recent activity">
            <DataList>
              {activity.map((entry) => (
                <DataListRow
                  key={entry.key}
                  leading={
                    <RowIcon>
                      <entry.icon />
                    </RowIcon>
                  }
                  meta={<span className="tabular">{formatDay(entry.when)}</span>}
                  title={entry.title}
                />
              ))}
            </DataList>
          </Section>
        ) : null}
      </PageSections>
    </>
  );
}
