import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedEvents, type CachedEvent } from "@/lib/site/get-site-events";
import { headingScaleClass, widthClass } from "@/components/website/blocks/tokens";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function EventCard({ event }: { event: CachedEvent }) {
  const start = new Date(event.startAt);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-site-muted/15 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-site-secondary/10">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-site-background"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 75%, white), var(--color-accent))",
            }}
          >
            <span className="text-3xl font-bold leading-none">
              {start.toLocaleDateString("en-US", { day: "numeric" })}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">
              {start.toLocaleDateString("en-US", { month: "short" })}
            </span>
          </div>
        )}
        {event.status === "REGISTRATION_CLOSED" ? (
          <Badge variant="secondary" className="absolute right-3 top-3">
            Registration closed
          </Badge>
        ) : event.status === "COMPLETED" ? (
          <Badge variant="secondary" className="absolute right-3 top-3">
            Past event
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-site-accent">
          {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          {" · "}
          {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug text-site-foreground group-hover:text-site-accent">
          {event.title}
        </h2>
        {event.location ? (
          <p className="mt-auto flex items-center gap-1.5 pt-3 text-sm text-site-muted">
            <MapPin className="size-3.5 shrink-0" />
            {event.location}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.events) notFound();

  const events = await getCachedEvents(data.site.site.id, siteSlug);

  return (
    <div className={cn(widthClass.wide, "py-20")}>
      <p className="text-sm font-semibold uppercase tracking-wide text-site-accent">
        What&apos;s happening
      </p>
      <h1 className={cn(headingScaleClass.h1, "mt-2 text-site-foreground")}>Events</h1>

      {events.length === 0 ? (
        <p className="mt-16 text-lg text-site-muted">No upcoming events.</p>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
