import { cache } from "react";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache/redis";
import { toSiteConfig } from "./to-site-config";
import { getSiteContent } from "./get-site-content";
import { SiteConfig, SiteContent } from "./types";

/**
 * React `cache()` dedupes this across generateMetadata + layout + page
 * within one render pass; the Redis `cached()` layer inside dedupes across
 * requests and serverless invocations (falls through to Postgres untouched
 * if Redis isn't configured).
 */
export const getPublishedSiteBySlug = cache(
  async (slug: string): Promise<{ site: SiteConfig; content: SiteContent } | null> => {
    return cached(`site:${slug}:published`, 3600, async () => {
      const site = await prisma.site.findFirst({
        where: { slug, status: "PUBLISHED" },
        include: { socialLinks: true, pages: true },
      });
      if (!site) return null;

      const siteConfig = toSiteConfig(site);
      const content = await getSiteContent(site.id);

      return { site: siteConfig, content };
    });
  }
);
