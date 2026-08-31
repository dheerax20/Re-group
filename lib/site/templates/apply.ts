import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { heroImageIn } from "@/lib/site/blocks/hero";
import { HOME_PATH } from "@/lib/site/blocks/resolve-page";
import { invalidateSite } from "@/lib/site/invalidate";
import { generateNavigation } from "@/lib/site/navigation";
import { editableSitePages, mergeNavigation } from "@/lib/site/pages";
import { parseHeroImage, withStoryFeedback } from "@/lib/site/story";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { resolveTemplateCopy } from "./copy";
import { templateProfile } from "./profile";
import { siteTemplateById } from "./index";
import type { SiteTemplateId } from "./types";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Applies a pre-built template to a site.
 *
 * The template path's answer to `commitBuild` (`lib/ai/generation-job.ts`),
 * and deliberately its mirror image: same columns, same transaction shape,
 * same closing `invalidateSite`. What it does NOT do is the point —
 *
 * - **no `SiteGenerationJob` row.** That table IS the AI ledger
 *   (`lib/ai/usage.ts` counts rows), so creating one just to track progress
 *   would silently spend one of the church's monthly builds.
 * - **no `assertAiBudget`, no Trigger.dev run.** There is no provider call to
 *   budget for, and nothing here takes long enough to need a durable run.
 *
 * Authorization is the caller's job, exactly as it is for every other function
 * in `lib/site/service.ts` — this must only be reached through
 * `paidSiteProcedure`.
 */
export async function applyTemplateToSite(
  siteId: string,
  templateId: SiteTemplateId
): Promise<{ styleName: string }> {
  const template = siteTemplateById(templateId);
  if (!template) throw new Error(`Unknown template "${templateId}"`);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true, pages: true },
  });
  if (!site) throw new Error("Site not found");

  const config = toSiteConfig(site);
  const profile = templateProfile(config, {
    // The church's own tagline lives on the column, not in `brandConfig`.
    tagline: site.tagline,
    /**
     * Switching template gives a different photograph rather than the same
     * picture in a new frame. Re-applying the SAME template does not — that is
     * how a church picks up a change to their own details, and having the
     * picture move under them at the same time would read as a different bug.
     */
    previousHeroImage:
      site.templateId === template.id ? undefined : parseHeroImage(site.storyConfig),
  });

  const copy = resolveTemplateCopy(profile);
  const home = template.buildHome(profile);
  const heroImageUrl = heroImageIn(home);

  const pages = editableSitePages(config.features)
    .filter((page) => page.href !== HOME_PATH)
    .map((page) => ({ path: page.href, blocks: template.buildPage(page.href, profile) }))
    .filter((page): page is { path: string; blocks: NonNullable<typeof page.blocks> } =>
      Boolean(page.blocks?.length)
    );

  /**
   * Every stored page is replaced, not merged.
   *
   * "The template is copied exactly to the site" is the whole contract, and a
   * row left behind from a previous design would render that design's `/about`
   * under this one's homepage. A church that has hand-edited a page is told
   * this overwrites their work before they get here.
   */
  await prisma.$transaction([
    prisma.sitePage.deleteMany({ where: { siteId } }),
    prisma.site.update({
      where: { id: siteId },
      data: {
        templateId: template.id,
        templateVersion: template.version,
        // The homepage goes in this update rather than through
        // `pageBlocksWriteOp`, which would issue a second `site.update` in the
        // same transaction to set one more column.
        blockConfig: toJson(home),
        navigationConfig: toJson(
          mergeNavigation(
            config.features,
            // Keep the church's own labels and ordering when they have any.
            config.navigation.length > 0 ? config.navigation : generateNavigation(config.features)
          )
        ),
        seoConfig: toJson({
          title: `${profile.churchName}${profile.tagline ? ` — ${profile.tagline}` : ""}`,
          description: copy.seoDescription,
        }),
        storyConfig: toJson({
          // Spreads the RAW column, so the six church-story keys survive.
          // Passing no feedback clears the AI's improvement lists, which is
          // correct: they describe a design this site no longer has.
          ...withStoryFeedback(site.storyConfig, {}),
          agentLog: [],
          styleName: template.name,
          navVariant: template.navVariant,
          ...(heroImageUrl ? { heroImageUrl } : {}),
        }),
      },
    }),
    ...pages.map((page) =>
      prisma.sitePage.create({
        data: { siteId, path: page.path, blockConfig: toJson(page.blocks) },
      })
    ),
  ]);

  await invalidateSite(siteId, { slug: site.slug });

  return { styleName: template.name };
}
