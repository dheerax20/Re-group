import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  ExternalLink,
  Globe,
  Mic2,
  PanelsTopLeft,
  Video,
} from "lucide-react";
import { resolveActiveSite, getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { getDomains } from "@/lib/domains/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard — Regroup" };

function formatEventDate(value: string | Date): string {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const active = await resolveActiveSite();
  if (!active) redirect("/builder");

  const [site, content, domains] = await Promise.all([
    getSite(active.id),
    getSiteContent(active.id),
    getDomains(active.id),
  ]);

  const published = active.status === "PUBLISHED";
  const upcoming = content.events.slice(0, 5);

  const links = [
    {
      href: "/events",
      label: "Events",
      count: content.events.length,
      icon: Calendar,
      hint: "Shows on your public calendar",
    },
    {
      href: "/sermons",
      label: "Sermons",
      count: content.sermons.length,
      icon: Mic2,
      hint: "Synced to the sermons page",
    },
    {
      href: "/youtube",
      label: "YouTube",
      count: site?.youtube?.channelUrl ? 1 : 0,
      icon: Video,
      hint: site?.youtube?.channelUrl ? "Channel connected" : "Not connected",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={active.name}
        description="Everything that appears on your church website, in one place."
        actions={
          <>
            <Link href="/dashboard/pages">
              <Button variant="outline">Pages &amp; links</Button>
            </Link>
            <Link href="/dashboard/builder">
              <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
                <PanelsTopLeft className="size-4" />
                Website editor
              </Button>
            </Link>
          </>
        }
      />

      {/* Where the site stands right now — the question every church opens this page to ask. */}
      <Card
        variant={published ? "raised" : "feature"}
        className="flex flex-wrap items-center gap-x-4 gap-y-3"
      >
        <Badge variant={published ? "success" : "warning"} dot>
          {published ? "Live" : "Draft"}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {published ? domains.canonicalHost : "Not published yet"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {published
              ? "Anyone with the address can visit your site."
              : "Publish from the website editor when you are ready for visitors."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/domains">
            <Button variant="ghost" size="sm">
              <Globe className="size-3.5" />
              {domains.domains.length > 0 ? "Manage domains" : "Add your domain"}
            </Button>
          </Link>
          {published ? (
            <a
              href={`https://${domains.canonicalHost}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                Visit
                <ExternalLink className="size-3.5" />
              </Button>
            </a>
          ) : null}
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card
              interactive
              className="flex h-full items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <item.icon className="size-4 text-brand" />
                  {item.label}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  <span className="tabular font-medium text-foreground">
                    {item.count}
                  </span>{" "}
                  · {item.hint}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Upcoming events</CardTitle>
            <CardDescription>
              New events publish to your live site automatically.
            </CardDescription>
          </div>
          <Link href="/events" className="text-sm font-medium text-brand hover:underline">
            Manage
          </Link>
        </div>

        <div className="mt-4">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Nothing on the calendar"
              description="Add your Sunday service or the next church gathering."
              compact
              action={
                <Link href="/events">
                  <Button size="sm">Add an event</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {upcoming.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-background px-4 py-3"
                >
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="tabular text-xs text-muted">
                    {formatEventDate(event.startAt)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
