"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { invalidateSiteCache } from "@/lib/cache/redis";
import { toDatabaseError } from "@/lib/db/errors";
import { slugify } from "@/lib/validation/slug";
import { generateNavigation } from "@/lib/site/navigation";
import type { FeatureConfig } from "@/lib/features/types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const eventSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  description: z.string().max(2000).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  registrationUrl: z.string().url().optional().or(z.literal("")),
});

const sermonSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  speaker: z.string().max(120).optional().or(z.literal("")),
  series: z.string().max(120).optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  videoUrl: z.string().url().optional().or(z.literal("")),
  audioUrl: z.string().url().optional().or(z.literal("")),
});

const youtubeSchema = z.object({
  channelUrl: z.string().url("Enter a valid YouTube URL").or(z.literal("")),
});

function uniqueSlug(base: string, existing: string[]) {
  let slug = slugify(base) || "item";
  if (!existing.includes(slug)) return slug;
  let i = 2;
  while (existing.includes(`${slug}-${i}`)) i += 1;
  return `${slug}-${i}`;
}

async function revalidateSite(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { slug: true } });
  if (site?.slug) {
    revalidatePath(`/sites/${site.slug}`);
    revalidatePath(`/sites/${site.slug}/about`);
    revalidatePath(`/sites/${site.slug}/contact`);
    revalidatePath(`/sites/${site.slug}/giving`);
    revalidatePath(`/sites/${site.slug}/ministries`);
    revalidatePath(`/sites/${site.slug}/events`);
    revalidatePath(`/sites/${site.slug}/sermons`);
    await invalidateSiteCache(site.slug);
  }
  revalidatePath(`/builder/${siteId}`);
  revalidatePath(`/builder/${siteId}/events`);
  revalidatePath(`/builder/${siteId}/sermons`);
  revalidatePath(`/builder/${siteId}/youtube`);
  revalidatePath("/events");
  revalidatePath("/sermons");
  revalidatePath("/youtube");
  revalidatePath("/dashboard");
}

/** Turn on a feature + matching homepage section so new content shows on the public site. */
async function enableFeatureOnSite(
  siteId: string,
  feature: "events" | "sermons" | "youtube",
  sectionSeed?: { variant: string; config?: Record<string, unknown> }
) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  const features = {
    ...((site.featureConfig as unknown as FeatureConfig) ?? {}),
    [feature]: true,
  } as FeatureConfig;

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

  await prisma.site.update({
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
    const data = eventSchema.parse(input);
    const existing = await prisma.event.findMany({
      where: { siteId },
      select: { slug: true },
    });
    const slug = uniqueSlug(data.title, existing.map((e) => e.slug));

    const event = await prisma.event.create({
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

    await enableFeatureOnSite(siteId, "events", { variant: "grid" });
    await revalidateSite(siteId);
    return { success: true as const, event };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function deleteEvent(siteId: string, eventId: string) {
  try {
    await prisma.event.deleteMany({ where: { id: eventId, siteId } });
    await revalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function listSermons(siteId: string) {
  try {
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
    const data = sermonSchema.parse(input);
    const existing = await prisma.sermon.findMany({
      where: { siteId },
      select: { slug: true },
    });
    const slug = uniqueSlug(data.title, existing.map((s) => s.slug));

    const sermon = await prisma.sermon.create({
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

    await enableFeatureOnSite(siteId, "sermons", { variant: "cards" });
    await revalidateSite(siteId);
    return { success: true as const, sermon };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function deleteSermon(siteId: string, sermonId: string) {
  try {
    await prisma.sermon.deleteMany({ where: { id: sermonId, siteId } });
    await revalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function updateYoutubeChannel(siteId: string, input: unknown) {
  try {
    const data = youtubeSchema.parse(input);
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new Error("Site not found");

    if (data.channelUrl) {
      await enableFeatureOnSite(siteId, "youtube", {
        variant: "featured",
        config: { channelUrl: data.channelUrl },
      });
    } else {
      const features = {
        ...((site.featureConfig as unknown as FeatureConfig) ?? {}),
        youtube: false,
      } as FeatureConfig;
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

    await revalidateSite(siteId);
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}
