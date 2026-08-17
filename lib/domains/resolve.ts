import { prisma } from "@/lib/db";
import { cached, invalidateHostnameCache } from "@/lib/cache/redis";

/**
 * Maps an incoming Host header to the site slug that should serve it.
 *
 * Only ACTIVE domains resolve. A pending domain that already has DNS pointed
 * here must NOT serve the site yet, because until Vercel has verified it the
 * hostname may still belong to somebody else.
 *
 * This is deliberately cached: it runs on every request to a custom domain,
 * including for hostnames that resolve to nothing, so the negative case is
 * cached too — otherwise pointing any DNS record at us would be a free way to
 * generate database load.
 */

export const HOSTNAME_TTL_SECONDS = 300;
export const HOSTNAME_NEGATIVE_TTL_SECONDS = 60;

export function hostnameCacheKey(hostname: string): string {
  return `host:${hostname.toLowerCase()}`;
}

/** Database lookup with no caching. The cache layers call this. */
export async function lookupHostnameInDb(hostname: string): Promise<string | null> {
  const domain = await prisma.siteDomain.findFirst({
    where: {
      hostname: hostname.toLowerCase(),
      status: "ACTIVE",
      site: { status: "PUBLISHED" },
    },
    select: { site: { select: { slug: true } } },
  });
  return domain?.site.slug ?? null;
}

/** Cached resolution, for app code that can reach Postgres. */
export async function resolveHostnameToSlug(hostname: string): Promise<string | null> {
  const key = hostnameCacheKey(hostname);
  const result = await cached<{ slug: string }>(
    key,
    HOSTNAME_TTL_SECONDS,
    async () => {
      const slug = await lookupHostnameInDb(hostname);
      return slug ? { slug } : null;
    },
    HOSTNAME_NEGATIVE_TTL_SECONDS
  );
  return result?.slug ?? null;
}

/** Drops cache entries for a site's hostnames after any change. */
export async function invalidateSiteHostnames(siteId: string): Promise<void> {
  const domains = await prisma.siteDomain.findMany({
    where: { siteId },
    select: { hostname: true },
  });
  await invalidateHostnameCache(domains.map((domain) => domain.hostname));
}
