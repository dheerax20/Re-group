import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveActiveSite, getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Calendar, Mic2, Video, ArrowRight, PanelsTopLeft } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: preferred } = await searchParams;
  const active = await resolveActiveSite(preferred ?? null);

  if (!active) {
    redirect("/builder");
  }

  const [site, content] = await Promise.all([
    getSite(active.id),
    getSiteContent(active.id),
  ]);

  const q = `?siteId=${active.id}`;
  const links = [
    {
      href: `/events${q}`,
      label: "Events",
      count: content.events.length,
      icon: Calendar,
      hint: "Shows on your public calendar",
    },
    {
      href: `/sermons${q}`,
      label: "Sermons",
      count: content.sermons.length,
      icon: Mic2,
      hint: "Synced to the sermons section",
    },
    {
      href: `/youtube${q}`,
      label: "YouTube",
      count: site?.youtube?.channelUrl ? 1 : 0,
      icon: Video,
      hint: site?.youtube?.channelUrl ? "Channel connected" : "Not connected",
    },
  ];

  return (
    <div>
      <PageHeader
        title={active.name}
        description="Manage content that appears on your church website."
        actions={
          <Link href={`/dashboard/builder?siteId=${active.id}`}>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              <PanelsTopLeft className="mr-2 h-4 w-4" />
              Website
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/40"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium">
                <item.icon className="h-4 w-4 text-brand" />
                {item.label}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {item.count} · {item.hint}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Upcoming events</h2>
            <p className="mt-1 text-sm text-muted">
              New events publish to your live site automatically.
            </p>
          </div>
          <Link href={`/events${q}`} className="text-sm text-brand hover:underline">
            Manage
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {content.events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              No events yet. Add one from Events.
            </p>
          ) : (
            content.events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-border bg-background px-3 py-3"
              >
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(event.startAt).toLocaleString()}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
