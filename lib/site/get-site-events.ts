import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache/redis";

/** Statuses a church has made visible to the public — drafts and cancelled
 * events never render, even if a stale cache entry is served. */
const PUBLIC_EVENT_STATUSES = ["PUBLISHED", "REGISTRATION_CLOSED", "COMPLETED"] as const;

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
  status: (typeof PUBLIC_EVENT_STATUSES)[number];
  rsvpEnabled: boolean;
  allowGuests: boolean;
  capacity: number | null;
  registrationDeadline: string | null;
  address: string | null;
  organizer: string | null;
  category: string | null;
}

/** Full event list for a site, cached — list/detail pages read this instead
 * of issuing their own DB queries. */
export async function getCachedEvents(siteId: string, slug: string): Promise<CachedEvent[]> {
  // An empty list is a real value, not an absent one, so it never takes the
  // negative-cache path — `?? []` only covers the `cached` signature.
  const events = await cached(`site:${slug}:events`, 3600, async () => {
    const events = await prisma.event.findMany({
      where: { siteId, status: { in: [...PUBLIC_EVENT_STATUSES] } },
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
      status: e.status as (typeof PUBLIC_EVENT_STATUSES)[number],
      rsvpEnabled: e.rsvpEnabled,
      allowGuests: e.allowGuests,
      capacity: e.capacity,
      registrationDeadline: e.registrationDeadline ? e.registrationDeadline.toISOString() : null,
      address: e.address,
      organizer: e.organizer,
      category: e.category,
    }));
  });

  return events ?? [];
}

export function findEventBySlug(events: CachedEvent[], slug: string): CachedEvent | undefined {
  return events.find((e) => e.slug === slug);
}
