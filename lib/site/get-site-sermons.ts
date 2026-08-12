import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache/redis";

/** Serializable mirror of the Sermon model — dates as ISO strings so it
 * survives a JSON round-trip through Redis. */
export interface CachedSermon {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  speaker: string | null;
  series: string | null;
  date: string;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  transcript: string | null;
}

/** Full sermon list for a site, cached — search/detail lookups filter this
 * in memory instead of issuing separate DB queries. */
export async function getCachedSermons(siteId: string, slug: string): Promise<CachedSermon[]> {
  return cached(`site:${slug}:sermons`, 3600, async () => {
    const sermons = await prisma.sermon.findMany({
      where: { siteId },
      orderBy: { date: "desc" },
    });

    return sermons.map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      description: s.description,
      speaker: s.speaker,
      series: s.series,
      date: s.date.toISOString(),
      videoUrl: s.videoUrl,
      audioUrl: s.audioUrl,
      thumbnailUrl: s.thumbnailUrl,
      transcript: s.transcript,
    }));
  });
}

export function filterSermons(sermons: CachedSermon[], q?: string): CachedSermon[] {
  if (!q) return sermons;
  const needle = q.toLowerCase();
  return sermons.filter(
    (s) =>
      s.title.toLowerCase().includes(needle) ||
      (s.speaker?.toLowerCase().includes(needle) ?? false) ||
      (s.series?.toLowerCase().includes(needle) ?? false)
  );
}

export function findSermonBySlug(sermons: CachedSermon[], slug: string): CachedSermon | undefined {
  return sermons.find((s) => s.slug === slug);
}
