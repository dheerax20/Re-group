import { prisma } from "@/lib/db";
import { churchInfoSchema } from "@/lib/validation/church";
import { brandConfigSchema, defaultBrandConfig } from "@/lib/validation/brand";
import { socialLinksSchema, toSocialLinkRecords } from "@/lib/validation/social";
import { sectionConfigSchema } from "@/lib/validation/section";
import { slugSchema, slugify } from "@/lib/validation/slug";
import { wizardHref } from "@/lib/onboarding/steps";
import { defaultFeatures, type FeatureConfig } from "@/lib/features/types";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { generateNavigation } from "@/lib/site/navigation";
import { mergeNavigation, allowedHrefs } from "@/lib/site/pages";
import { navigationConfigSchema } from "@/lib/validation/navigation";
import { validateSiteForPublish } from "@/lib/site/publish-validation";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { invalidateSite } from "@/lib/site/invalidate";
import { syncPrimaryDomain } from "@/lib/domains/actions-support";
import { toDatabaseError, isDatabaseUnavailableError } from "@/lib/db/errors";
import type { Prisma } from "@prisma/client";

/**
 * Site mutations, as plain functions.
 *
 * These were `"use server"` actions whose first line was always an ownership
 * and billing check. That check now lives in `paidSiteProcedure`
 * (`server/trpc/trpc.ts`), where it is a middleware every site-scoped
 * procedure inherits rather than a line each new action had to remember.
 *
 * Nothing else about them changed: same validation order, same transactions,
 * same invalidation. These functions assume authorization has already
 * happened, so they must only ever be reached through a tRPC procedure or a
 * Trigger.dev task acting on a job that was authorized when it was queued.
 */

/**
 * A draft that has not chosen a design yet.
 *
 * Was the literal `"modern-church"`, a name left over from a stock-template
 * registry that no longer exists — it referred to nothing, and
 * `validateSiteForPublish` rejected it without saying why. Naming the state
 * makes "no design yet" something the picker and `resumeHref` can read.
 */
export const UNSET_TEMPLATE_ID = "unset";

/** Prisma's Json columns want InputJsonValue; our domain types are plain
 * serializable objects/arrays, so this cast is safe at every call site. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createDraftSite(userId: string, existingSiteId?: string) {
  try {
    if (existingSiteId) {
      return { siteId: existingSiteId, existing: true as const };
    }

    const site = await prisma.site.create({
      data: {
        userId,
        name: "Untitled Church",
        slug: `untitled-${Math.random().toString(36).slice(2, 8)}`,
        brandConfig: toJson(defaultBrandConfig),
        featureConfig: toJson(defaultFeatures),
        navigationConfig: toJson([]),
        sectionConfig: toJson([]),
        seoConfig: toJson({ title: "", description: "" }),
        storyConfig: toJson({}),
        templateId: UNSET_TEMPLATE_ID,
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
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      status: true,
      sectionConfig: true,
      blockConfig: true,
      generationJobs: {
        where: { kind: "full_build", status: { in: ["QUEUED", "RUNNING"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!site) return "/builder";

  if (site.status === "PUBLISHED") return "/dashboard";

  /**
   * A church that closed the tab mid-build comes back to the build, not to the
   * picker. The design step now shows a chooser by default, and dropping
   * someone onto it while their paid-for build is still running reads as the
   * build having been lost.
   */
  if (site.generationJobs.length > 0) return `${wizardHref("templates", siteId)}&mode=ai`;

  const sections = Array.isArray(site.sectionConfig) ? site.sectionConfig : [];
  const blocks = Array.isArray(site.blockConfig) ? site.blockConfig : [];
  return sections.length === 0 && blocks.length === 0
    ? wizardHref("templates", siteId)
    : wizardHref("publish", siteId);
}

export async function getSite(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true, pages: true },
  });
  if (!site) return null;
  return toSiteConfig(site);
}

/**
 * The handful of scalars the dashboard shows *about* a site rather than *from*
 * it: whether it is live, when it last went live, and how much content it has.
 *
 * Deliberately not part of `getSite`. Overview and Website Builder need these
 * counts and nothing else, and `getSite` pulls every page's block tree through
 * `toSiteConfig` to produce them — a whole render config parsed to print the
 * number 3.
 */
export async function getSiteSummary(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { sermons: true, events: true, pages: true } },
    },
  });
  if (!site) return null;

  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    // Dates cross the tRPC boundary through superjson, so these stay Date
    // objects on the client rather than becoming strings.
    publishedAt: site.publishedAt,
    updatedAt: site.updatedAt,
    counts: {
      sermons: site._count.sermons,
      events: site._count.events,
      pages: site._count.pages,
    },
  };
}

/** The signed-in user's site only — one website per Clerk account. */
export async function resolveActiveSite(user: {
  site: { id: string; name: string; slug: string; status: string } | null;
}) {
  try {
    return user.site;
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

  const current = await prisma.site.findUnique({
    where: { id: siteId },
    select: { storyConfig: true },
  });
  const existingStory =
    current?.storyConfig && typeof current.storyConfig === "object" && !Array.isArray(current.storyConfig)
      ? (current.storyConfig as Record<string, unknown>)
      : {};

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
      /**
       * Merged over whatever the column already holds, not written over it.
       *
       * `storyConfig` is a flat bag: the six church-story keys share it with
       * `styleName`, `navVariant`, `heroImageUrl` and the AI feedback lists.
       * Replacing the object wholesale dropped all of them, so a church that
       * edited their info after their site was designed silently lost the
       * navbar treatment their design had chosen — `parseNavVariant` fell back
       * to `solid` and the transparent-over-photo header turned opaque. Same
       * bug `withStoryFeedback` was written to fix on the edit paths.
       */
      storyConfig: toJson({
        ...(existingStory ?? {}),
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
  const data = brandConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { brandConfig: toJson(data) },
  });
  await invalidateSite(siteId);
  return { success: true };
}

export async function updateFeatures(siteId: string, input: FeatureConfig) {
  const errors = validateFeatureDependencies(input);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      featureConfig: toJson(input),
      navigationConfig: toJson(generateNavigation(input)),
    },
  });
  await invalidateSite(siteId);
  return { success: true };
}

export async function updateSections(siteId: string, input: unknown) {
  const data = sectionConfigSchema.parse(input);
  await prisma.site.update({
    where: { id: siteId },
    data: { sectionConfig: toJson(data) },
  });
  await invalidateSite(siteId);
  return { success: true };
}

export async function updateNavigation(siteId: string, input: unknown) {
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
    include: { socialLinks: true, pages: true },
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

  return { success: true as const, slug: parsedSlug };
}

export async function unpublishSite(siteId: string) {
  const site = await prisma.site.update({
    where: { id: siteId },
    data: { status: "DRAFT" },
  });
  await invalidateSite(siteId, { slug: site.slug });
  return { success: true };
}
