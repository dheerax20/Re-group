import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedEvents, findEventBySlug } from "@/lib/site/get-site-events";
import { buttonVariants } from "@/components/ui/button";
import { headingScaleClass } from "@/components/website/blocks/tokens";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const { siteSlug, slug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.events) notFound();

  const allEvents = await getCachedEvents(data.site.site.id, siteSlug);
  const event = findEventBySlug(allEvents, slug);
  if (!event) notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-base font-semibold uppercase tracking-wide text-site-accent">
        {new Date(event.startAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
      <h1 className={cn(headingScaleClass.h1, "mt-2 text-site-foreground")}>{event.title}</h1>
      {event.location && <p className="mt-2 text-lg text-site-muted">{event.location}</p>}
      {event.description && (
        <p className="mt-8 text-lg leading-relaxed text-site-muted">{event.description}</p>
      )}
      {event.registrationUrl && (
        <a
          href={event.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "site", size: "lg", className: "mt-8" })}
        >
          Register
        </a>
      )}
      <div className="mt-10">
        <Link href="/events" className="text-base underline">
          &larr; Back to all events
        </Link>
      </div>
    </article>
  );
}
