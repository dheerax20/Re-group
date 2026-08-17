"use server";

import { prisma, type DbClient } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { requireOwnedPaidSite, requireOwnedSite } from "@/lib/auth/session";
import { toDatabaseError } from "@/lib/db/errors";
import { slugify } from "@/lib/validation/slug";
import { generateNavigation } from "@/lib/site/navigation";
import { httpsUrlSchema } from "@/lib/validation/url";
import { defaultFeatures, type FeatureConfig } from "@/lib/features/types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

function mergeFeatures(stored: unknown, patch: Partial<FeatureConfig>): FeatureConfig {
  return {
    ...defaultFeatures,
    ...((stored as FeatureConfig | null) ?? {}),
    ...patch,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const eventSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  description: z.string().max(2000).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  registrationUrl: httpsUrlSchema.optional(),
});

const sermonSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  speaker: z.string().max(120).optional().or(z.literal("")),
  series: z.string().max(120).optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  videoUrl: httpsUrlSchema.optional(),
  audioUrl: httpsUrlSchema.optional(),
});

const youtubeSchema = z.object({
  channelUrl: httpsUrlSchema,
});

function uniqueSlug(base: string, existing: string[]) {
  const slug = slugify(base) || "item";
  if (!existing.includes(slug)) return slug;
  let i = 2;
  while (existing.includes(`${slug}-${i}`)) i += 1;
  return `${slug}-${i}`;
}


/** Turn on a feature + matching homepage section so new content shows on the public site. */
async function enableFeatureOnSite(
  siteId: string,
  feature: "events" | "sermons" | "youtube",
  sectionSeed?: { variant: string; config?: Record<string, unknown> },
  db: DbClient = prisma
) {
  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  const features = mergeFeatures(site.featureConfig, { [feature]: true });

  const sections = Array.isArray(site.sectionConfig)
    ? (site.sectionConfig as Array<Record<string, unknown>>)
    : [];

  let found = false;
  const nextSections = sections.map((section) => {
    if (section.type !== feature) return section;
    found = true;
    return {
      ...section,
      enabled: true,
      config: {
        ...((section.config as Record<string, unknown>) ?? {}),
        ...(sectionSeed?.config ?? {}),
      },
    };
  });

  if (!found && sectionSeed) {
    const insertAt = Math.max(nextSections.length - 1, 0);
    nextSections.splice(insertAt, 0, {
      id: feature,
      type: feature,
      variant: sectionSeed.variant,
      enabled: true,
      config: sectionSeed.config ?? {},
    });
  }

  await db.site.update({
    where: { id: siteId },
    data: {
      featureConfig: toJson(features),
      sectionConfig: toJson(nextSections),
      navigationConfig: toJson(generateNavigation(features)),
    },
  });
}

export async function listEvents(siteId: string) {
  try {
    await requireOwnedSite(siteId);
    return await prisma.event.findMany({
      where: { siteId },
      orderBy: { startAt: "asc" },
    });
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function createEvent(siteId: string, input: unknown) {
  try {
    await requireOwnedPaidSite(siteId);
    const data = eventSchema.parse(input);
    const existing = await prisma.event.findMany({
      where: { siteId },
      select: { slug: true },
    });
    const slug = uniqueSlug(data.title, existing.map((e) => e.slug));

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          siteId,
          title: data.title,
          slug,
          description: data.description || null,
          startAt: new Date(data.startAt),
          endAt: data.endAt ? new Date(data.endAt) : null,
          location: data.location || null,
          registrationUrl: data.registrationUrl || null,
        },
      });
      await enableFeatureOnSite(siteId, "events", { variant: "grid" }, tx);
      return created;
    });

    await invalidateSite(siteId);
    return { success: true as const, event };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function deleteEvent(siteId: string, eventId: string) {
  try {
    await requireOwnedPaidSite(siteId);
    await prisma.event.deleteMany({ where: { id: eventId, siteId } });
    await invalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function listSermons(siteId: string) {
  try {
    await requireOwnedSite(siteId);
    return await prisma.sermon.findMany({
      where: { siteId },
      orderBy: { date: "desc" },
    });
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function createSermon(siteId: string, input: unknown) {
  try {
    await requireOwnedPaidSite(siteId);
    const data = sermonSchema.parse(input);
    const existing = await prisma.sermon.findMany({
      where: { siteId },
      select: { slug: true },
    });
    const slug = uniqueSlug(data.title, existing.map((s) => s.slug));

    const sermon = await prisma.$transaction(async (tx) => {
      const created = await tx.sermon.create({
        data: {
          siteId,
          title: data.title,
          slug,
          description: data.description || null,
          speaker: data.speaker || null,
          series: data.series || null,
          date: new Date(data.date),
          videoUrl: data.videoUrl || null,
          audioUrl: data.audioUrl || null,
        },
      });
      await enableFeatureOnSite(siteId, "sermons", { variant: "cards" }, tx);
      return created;
    });

    await invalidateSite(siteId);
    return { success: true as const, sermon };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function deleteSermon(siteId: string, sermonId: string) {
  try {
    await requireOwnedPaidSite(siteId);
    await prisma.sermon.deleteMany({ where: { id: sermonId, siteId } });
    await invalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function updateYoutubeChannel(siteId: string, input: unknown) {
  try {
    await requireOwnedPaidSite(siteId);
    const data = youtubeSchema.parse(input);
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new Error("Site not found");

    if (data.channelUrl) {
      await enableFeatureOnSite(siteId, "youtube", {
        variant: "featured",
        config: { channelUrl: data.channelUrl },
      });
    } else {
      const features = mergeFeatures(site.featureConfig, { youtube: false });
      const sections = Array.isArray(site.sectionConfig)
        ? (site.sectionConfig as Array<Record<string, unknown>>)
        : [];
      const nextSections = sections.map((section) =>
        section.type === "youtube"
          ? {
              ...section,
              enabled: false,
              config: {
                ...((section.config as Record<string, unknown>) ?? {}),
                channelUrl: "",
              },
            }
          : section
      );
      await prisma.site.update({
        where: { id: siteId },
        data: {
          featureConfig: toJson(features),
          sectionConfig: toJson(nextSections),
          navigationConfig: toJson(generateNavigation(features)),
        },
      });
    }

    await invalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}
