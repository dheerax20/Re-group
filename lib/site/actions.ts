"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { churchInfoSchema } from "@/lib/validation/church";
import { brandConfigSchema, defaultBrandConfig } from "@/lib/validation/brand";
import { socialLinksSchema, toSocialLinkRecords } from "@/lib/validation/social";
import { sectionConfigSchema, coerceSections } from "@/lib/validation/section";
import { slugSchema, slugify } from "@/lib/validation/slug";
import { wizardHref } from "@/lib/onboarding/steps";
import { defaultFeatures, FeatureConfig } from "@/lib/features/types";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { generateNavigation } from "@/lib/site/navigation";
import { mergeNavigation, allowedHrefs } from "@/lib/site/pages";
import { navigationConfigSchema } from "@/lib/validation/navigation";
import { assertAiBudget } from "@/lib/ai/usage";
import {
  createJob,
  findActiveJob,
  getLatestJob,
  runFullBuildJob,
  type JobView,
} from "@/lib/ai/generation-job";
import { validateSiteForPublish } from "@/lib/site/publish-validation";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { parseChurchStory } from "@/lib/site/story";
import { invalidateSite } from "@/lib/site/invalidate";
import { syncPrimaryDomain } from "@/lib/domains/actions-support";
import {
  requireOwnedPaidSite,
  requireOwnedSite,
  syncCurrentUser,
} from "@/lib/auth/session";
import { z } from "zod";
import { toDatabaseError, isDatabaseUnavailableError } from "@/lib/db/errors";
import type { Prisma } from "@prisma/client";

/** Prisma's Json columns want InputJsonValue; our domain types are plain
 * serializable objects/arrays, so this cast is safe at every call site. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createDraftSite() {
  try {
    const user = await syncCurrentUser();
    if (user.site) {
      return { siteId: user.site.id, existing: true as const };
    }

    const site = await prisma.site.create({
      data: {
        userId: user.id,
        name: "Untitled Church",
        slug: `untitled-${Math.random().toString(36).slice(2, 8)}`,
        brandConfig: toJson(defaultBrandConfig),
        featureConfig: toJson(defaultFeatures),
        navigationConfig: toJson([]),
        sectionConfig: toJson([]),
        seoConfig: toJson({ title: "", description: "" }),
        storyConfig: toJson({}),
        templateId: "modern-church",
        templateVersion: 1,
      },
    });
    return { siteId: site.id, existing: false as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

/**
 * Where a signed-in user with a site should land.
 *
 * `createDraftSite` writes the `Site` row the moment the wizard starts —
 * before any design has been generated or published — so `user.site` being
 * non-null was being treated as "has a website" by the post-auth and
 * wizard-root redirects. A church that dropped off after the "church info"
 * step got sent straight to `/dashboard` on every later visit: an empty
 * shell with zero sections and no visible way back into setup, which reads
 * as "there is no website here."
 *
 * This resolves the real state instead of assuming it: no sections yet →
 * back into the AI design step; sections but never published → the publish
 * step; published → the dashboard.
 */
export async function resumeHref(siteId: string): Promise<string> {
  await requireOwnedSite(siteId);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { status: true, sectionConfig: true },
  });
  if (!site) return "/builder";

  if (site.status === "PUBLISHED") return "/dashboard";

  const sections = Array.isArray(site.sectionConfig) ? site.sectionConfig : [];
  return sections.length === 0
    ? wizardHref("templates", siteId)
    : wizardHref("publish", siteId);
}

export async function getSite(siteId: string) {
  await requireOwnedSite(siteId);
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true },
  });
  if (!site) return null;
  return toSiteConfig(site);
}

/** The signed-in user's site only — one website per Auth0 account. */
export async function resolveActiveSite() {
  try {
    return await withDbRetry(async () => {
      const user = await syncCurrentUser();
      return user.site;
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
  await requireOwnedPaidSite(siteId);
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
      storyConfig: toJson({
        city: data.city || "",
        worshipStyle: data.worshipStyle || "",
        serviceTimes: data.serviceTimes || "",
        pastorName: data.pastorName || "",
        mission: data.mission || "",
        values: data.values || "",
      }),
    },
  });
  await invalidateSite(siteId);
  return { success: true };
}

export async function updateSocialLinks(siteId: string, input: unknown) {
  await requireOwnedPaidSite(siteId);
  const data = socialLinksSchema.parse(input);
  const records = toSocialLinkRecords(data);

  await prisma.$transaction([
    prisma.socialLink.deleteMany({ where: { siteId } }),
    ...records.map((r) =>
      prisma.socialLink.create({ data: { siteId, platform: r.platform, url: r.url } })
    ),
  ]);

  await invalidateSite(siteId);
  return { success: true };
}

export async function updateBrand(siteId: string, input: unknown) {
  await requireOwnedPaidSite(siteId);
  const data = brandConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { brandConfig: toJson(data) },
  });
  await invalidateSite(siteId);
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
  await requireOwnedPaidSite(siteId);
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
  await invalidateSite(siteId);
  return { success: true };
}

/**
 * Queues an AI website build and returns immediately.
 *
 * The work itself runs in `after()`, against a row the client can poll. That is
 * what makes the six-agent run survive a closed tab, and what lets the progress
 * display report the specialist that is actually working rather than a timer.
 */
export async function startAiWebsiteBuild(siteId: string) {
  const user = await requireOwnedPaidSite(siteId);

  const existing = await findActiveJob(siteId, "full_build");
  if (existing) {
    // Already running. Returning it rather than starting a second one is what
    // makes a double-click or a refresh cost nothing.
    return { job: await getLatestJob(siteId, "full_build") };
  }

  await assertAiBudget(siteId, user.id, "full_build");

  const job = await createJob(siteId, "full_build");
  after(() => runFullBuildJob(job.id));

  return { job };
}

/** Poll target for the generation UI. */
export async function getAiWebsiteBuildStatus(siteId: string): Promise<JobView | null> {
  await requireOwnedSite(siteId);
  return getLatestJob(siteId, "full_build");
}

export async function updateSections(siteId: string, input: unknown) {
  await requireOwnedPaidSite(siteId);
  const data = sectionConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { sectionConfig: toJson(data) },
  });
  await invalidateSite(siteId);
  return { success: true };
}

export async function updateNavigation(siteId: string, input: unknown) {
  await requireOwnedPaidSite(siteId);
  const parsed = navigationConfigSchema.parse(input);
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { featureConfig: true },
  });
  if (!site) throw new Error("Site not found");

  const features = site.featureConfig as unknown as FeatureConfig;
  const allowed = allowedHrefs(features);
  const invalid = parsed.find((item) => !allowed.has(item.href));
  if (invalid) {
    throw new Error(`Page ${invalid.href} is not available for this church`);
  }

  const navigation = mergeNavigation(features, parsed);
  await prisma.site.update({
    where: { id: siteId },
    data: { navigationConfig: toJson(navigation) },
  });
  await invalidateSite(siteId);
  return { success: true, navigation };
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
  await requireOwnedPaidSite(siteId);
  const parsedSlug = slugSchema.parse(slug);

  const before = await prisma.site.findUnique({
    where: { id: siteId },
    select: { slug: true },
  });

  // Validate BEFORE mutating. The old order renamed the site, then bailed out
  // on a validation error, leaving the slug changed on a site that never got
  // published — and the previous slug's caches never cleared.
  const candidate = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true },
  });
  if (!candidate) throw new Error("Site not found");

  const result = validateSiteForPublish(toSiteConfig({ ...candidate, slug: parsedSlug }));
  if (!result.valid) {
    return { success: false as const, errors: result.errors };
  }

  const taken = await prisma.site.findUnique({ where: { slug: parsedSlug } });
  if (taken && taken.id !== siteId) {
    return {
      success: false as const,
      errors: [{ field: "slug", message: "This address is already taken" }],
    };
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { slug: parsedSlug, status: "PUBLISHED", publishedAt: new Date() },
  });

  // A rename leaves the old slug's cache entries pointing at live content.
  if (before?.slug && before.slug !== parsedSlug) {
    await invalidateSite(siteId, { slug: before.slug });
  }
  await invalidateSite(siteId, { slug: parsedSlug });
  await syncPrimaryDomain(siteId);
  revalidatePath("/dashboard/domains");

  return { success: true as const, slug: parsedSlug };
}

export async function unpublishSite(siteId: string) {
  await requireOwnedPaidSite(siteId);
  const site = await prisma.site.update({
    where: { id: siteId },
    data: { status: "DRAFT" },
  });
  await invalidateSite(siteId, { slug: site.slug });
  return { success: true };
}
