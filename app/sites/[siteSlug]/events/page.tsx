import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.events) notFound();

  const events = await prisma.event.findMany({
    where: { siteId: data.site.site.id },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-site-foreground">Events</h1>
      {events.length === 0 ? (
        <p className="mt-8 text-site-muted">No upcoming events.</p>
      ) : (
        <ul className="mt-8 divide-y divide-site-muted/15">
          {events.map((event) => (
            <li key={event.id} className="py-5">
              <Link href={`/events/${event.slug}`} className="hover:text-site-accent">
                <h2 className="text-lg font-semibold">{event.title}</h2>
              </Link>
              <p className="mt-1 text-sm text-site-muted">
                {event.startAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
