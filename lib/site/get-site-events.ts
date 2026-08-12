import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache/redis";

/** Serializable mirror of the Event model — dates as ISO strings so it
 * survives a JSON round-trip through Redis. */
export interface CachedEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
}

/** Full event list for a site, cached — list/detail pages read this instead
 * of issuing their own DB queries. */
export async function getCachedEvents(siteId: string, slug: string): Promise<CachedEvent[]> {
  return cached(`site:${slug}:events`, 3600, async () => {
    const events = await prisma.event.findMany({
      where: { siteId },
      orderBy: { startAt: "asc" },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      description: e.description,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt ? e.endAt.toISOString() : null,
      location: e.location,
      imageUrl: e.imageUrl,
      registrationUrl: e.registrationUrl,
    }));
  });
}

export function findEventBySlug(events: CachedEvent[], slug: string): CachedEvent | undefined {
  return events.find((e) => e.slug === slug);
}
