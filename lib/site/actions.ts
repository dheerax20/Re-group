"use server";

import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { churchInfoSchema } from "@/lib/validation/church";
import { brandConfigSchema, defaultBrandConfig } from "@/lib/validation/brand";
import { socialLinksSchema, toSocialLinkRecords } from "@/lib/validation/social";
import { sectionConfigSchema } from "@/lib/validation/section";
import { slugSchema, slugify } from "@/lib/validation/slug";
import { defaultFeatures, FeatureConfig } from "@/lib/features/types";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { generateNavigation } from "@/lib/site/navigation";
import { getTemplate } from "@/lib/templates/registry";
import { DeterministicSiteGenerator } from "@/lib/ai/deterministic-site-generator";
import { getTemplateRecommendationEngine } from "@/lib/ai";
import { validateSiteForPublish } from "@/lib/site/publish-validation";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { z } from "zod";
import { toDatabaseError, isDatabaseUnavailableError } from "@/lib/db/errors";
import type { Prisma } from "@prisma/client";

const siteGenerator = new DeterministicSiteGenerator();

/** Prisma's Json columns want InputJsonValue; our domain types are plain
 * serializable objects/arrays, so this cast is safe at every call site. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createDraftSite() {
  try {
    const site = await prisma.site.create({
      data: {
        name: "Untitled Church",
        slug: `untitled-${Math.random().toString(36).slice(2, 8)}`,
        brandConfig: toJson(defaultBrandConfig),
        featureConfig: toJson(defaultFeatures),
        navigationConfig: toJson([]),
        sectionConfig: toJson([]),
        seoConfig: toJson({ title: "", description: "" }),
        templateId: "modern-church",
        templateVersion: 1,
      },
    });
    return { siteId: site.id };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function getSite(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true },
  });
  if (!site) return null;
  return toSiteConfig(site);
}

/** Prefer an explicit siteId, otherwise the most recently updated site. */
export async function resolveActiveSite(preferredSiteId?: string | null) {
  try {
    return await withDbRetry(async () => {
      if (preferredSiteId) {
        const preferred = await prisma.site.findUnique({
          where: { id: preferredSiteId },
          select: { id: true, name: true, slug: true, status: true },
        });
        if (preferred) return preferred;
      }

      return prisma.site.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, status: true },
      });
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error("[resolveActiveSite] Database unavailable.", error);
      return null;
    }
    throw error;
  }
}

export async function updateChurchInfo(siteId: string, input: unknown) {
  const data = churchInfoSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: {
      name: data.name,
      denomination: data.denomination || null,
      congregationSize: data.congregationSize ?? null,
      primaryContactName: data.primaryContactName || null,
      primaryContactEmail: data.primaryContactEmail || null,
      primaryContactPhone: data.primaryContactPhone || null,
      tagline: data.tagline || null,
    },
  });
  return { success: true };
}

export async function updateSocialLinks(siteId: string, input: unknown) {
  const data = socialLinksSchema.parse(input);
  const records = toSocialLinkRecords(data);

  await prisma.$transaction([
    prisma.socialLink.deleteMany({ where: { siteId } }),
    ...records.map((r) =>
      prisma.socialLink.create({ data: { siteId, platform: r.platform, url: r.url } })
    ),
  ]);

  return { success: true };
}

export async function updateBrand(siteId: string, input: unknown) {
  const data = brandConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { brandConfig: toJson(data) },
  });
  return { success: true };
}

const featureConfigSchema = z.object({
  sermons: z.boolean(),
  sermonSearch: z.boolean(),
  events: z.boolean(),
  youtube: z.boolean(),
  podcast: z.boolean(),
  giving: z.boolean(),
  ministries: z.boolean(),
  contact: z.boolean(),
});

export async function updateFeatures(siteId: string, input: unknown) {
  const data = featureConfigSchema.parse(input) as FeatureConfig;
  const errors = validateFeatureDependencies(data);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      featureConfig: toJson(data),
      navigationConfig: toJson(generateNavigation(data)),
    },
  });
  return { success: true };
}

export async function getTemplateRecommendations(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const engine = getTemplateRecommendationEngine();
  return engine.recommend({
    churchName: site.name,
    denomination: site.denomination ?? undefined,
    congregationSize: site.congregationSize ?? undefined,
    brand: site.brandConfig as never,
    features: site.featureConfig as never,
  });
}

export async function selectTemplate(siteId: string, templateId: string) {
  const template = getTemplate(templateId);
  if (!template) throw new Error("Unknown template");

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const generated = await siteGenerator.generateSiteConfig({
    churchName: site.name,
    tagline: site.tagline ?? undefined,
    denomination: site.denomination ?? undefined,
    brand: site.brandConfig as never,
    features: site.featureConfig as never,
    templateId: template.id,
  });

  await prisma.site.update({
    where: { id: siteId },
    data: {
      templateId: template.id,
      templateVersion: template.version,
      sectionConfig: toJson(generated.sections),
      navigationConfig: toJson(generated.navigation),
      seoConfig: toJson(generated.seo),
    },
  });

  return { success: true };
}

export async function updateSections(siteId: string, input: unknown) {
  const data = sectionConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { sectionConfig: toJson(data) },
  });
  return { success: true };
}

export async function checkSlugAvailable(slug: string, excludeSiteId?: string) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return { available: false, message: parsed.error.issues[0]?.message };
  }
  const existing = await prisma.site.findUnique({ where: { slug } });
  if (existing && existing.id !== excludeSiteId) {
    return { available: false, message: "This slug is already taken" };
  }
  return { available: true };
}

export async function suggestSlug(name: string) {
  return slugify(name);
}

export async function publishSite(siteId: string, slug: string) {
  const parsedSlug = slugSchema.parse(slug);

  await prisma.site.update({
    where: { id: siteId },
    data: { slug: parsedSlug },
  });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true },
  });
  if (!site) throw new Error("Site not found");

  const siteConfig = toSiteConfig(site);
  const result = validateSiteForPublish(siteConfig);
  if (!result.valid) {
    return { success: false, errors: result.errors };
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  revalidatePath(`/sites/${parsedSlug}`);

  return { success: true, slug: parsedSlug };
}

export async function unpublishSite(siteId: string) {
  const site = await prisma.site.update({
    where: { id: siteId },
    data: { status: "DRAFT" },
  });
  revalidatePath(`/sites/${site.slug}`);
  return { success: true };
}
