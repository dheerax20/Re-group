import { prisma } from "@/lib/db";
import { SiteContent } from "./types";
import { Prisma } from "@prisma/client";

const emptyContent: SiteContent = { sermons: [], events: [] };

function isDbUnavailable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error &&
      /Can't reach database server|ECONNREFUSED|P1001|P1017/i.test(error.message))
  );
}

export async function getSiteContent(siteId: string): Promise<SiteContent> {
  try {
    const [sermons, events] = await Promise.all([
      prisma.sermon.findMany({
        where: { siteId },
        orderBy: { date: "desc" },
        take: 20,
      }),
      prisma.event.findMany({
        where: {
          siteId,
          startAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
          status: { in: ["PUBLISHED", "REGISTRATION_CLOSED", "COMPLETED"] },
        },
        orderBy: { startAt: "asc" },
        take: 20,
      }),
    ]);

    return {
      sermons: sermons.map((s) => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
        speaker: s.speaker,
        series: s.series,
        date: s.date.toISOString(),
        thumbnailUrl: s.thumbnailUrl,
        description: s.description,
      })),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        startAt: e.startAt.toISOString(),
        location: e.location,
        imageUrl: e.imageUrl,
        description: e.description,
      })),
    };
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.error("[getSiteContent] Database unavailable — returning empty content.", error);
      return emptyContent;
    }
    throw error;
  }
}
