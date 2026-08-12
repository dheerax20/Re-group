import { cache } from "react";
import { prisma } from "@/lib/db";
import { toSiteConfig } from "./to-site-config";
import { getSiteContent } from "./get-site-content";
import { SiteConfig, SiteContent } from "./types";

/**
 * `cache()` dedupes this fetch across generateMetadata + layout + page for
 * the same request, so a published site is only ever queried once per
 * render pass.
 */
export const getPublishedSiteBySlug = cache(
  async (slug: string): Promise<{ site: SiteConfig; content: SiteContent } | null> => {
    const site = await prisma.site.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: { socialLinks: true },
    });
    if (!site) return null;

    const siteConfig = toSiteConfig(site);
    const content = await getSiteContent(site.id);

    return { site: siteConfig, content };
  }
);
