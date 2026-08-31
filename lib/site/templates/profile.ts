import type { SiteConfig } from "@/lib/site/types";
import type { TemplateProfile } from "./types";

/**
 * The church, as a template is allowed to see it.
 *
 * `tagline` is passed in rather than read off the config because the two
 * taglines in this app are different fields: `Site.tagline` is the one the
 * church types in the wizard's church-info step, and `brand.tagline` is the
 * one the brand step writes. `SiteConfig` only carries the second, so the
 * apply path hands the first in and this falls back to the second.
 */
export function templateProfile(
  site: SiteConfig,
  opts: { tagline?: string | null; previousHeroImage?: string } = {}
): TemplateProfile {
  const tagline = opts.tagline?.trim() || site.brand.tagline?.trim() || undefined;

  return {
    siteId: site.site.id,
    churchName: site.site.name,
    tagline,
    denomination: site.site.denomination,
    story: site.story ?? {},
    features: site.features,
    brand: site.brand,
    previousHeroImage: opts.previousHeroImage,
  };
}
