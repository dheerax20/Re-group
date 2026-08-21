import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedEvents } from "@/lib/site/get-site-events";
import { headingScaleClass, widthClass } from "@/components/website/blocks/tokens";
import { cn } from "@/lib/utils";

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
    /* Same width and heading scale as an AI-composed band, so this page lines
       up with the nav and footer around it instead of sitting a step smaller
       and inset. See components/website/blocks/tokens.ts. */
    <div className={cn(widthClass.wide, "py-20")}>
      <h1 className={cn(headingScaleClass.h1, "text-site-foreground")}>Events</h1>
      {events.length === 0 ? (
        <p className="mt-8 text-lg text-site-muted">No upcoming events.</p>
      ) : (
        <ul className="mt-8 divide-y divide-site-muted/15">
          {events.map((event) => (
            <li key={event.id} className="py-5">
              <Link href={`/events/${event.slug}`} className="hover:text-site-accent">
                <h2 className={headingScaleClass.h3}>{event.title}</h2>
              </Link>
              <p className="mt-1 text-base text-site-muted">
                {new Date(event.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
