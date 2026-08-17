import { Redis } from "@upstash/redis";

/**
 * Upstash's REST client is fetch-based — no persistent TCP connection to
 * exhaust across serverless invocations, unlike ioredis.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/**
 * Marker for "the source returned nothing, and that is the answer".
 *
 * Without it, a `null` in the cache is indistinguishable from a miss, so every
 * request for an unpublished or nonexistent slug reached Postgres — an
 * unauthenticated path with no ceiling on it. Storing the miss makes hostname
 * and slug enumeration cost Redis instead.
 */
const NEGATIVE = "__regroup_absent__";

/**
 * Cache-aside read: serve from Redis when available, otherwise fall through
 * to `fetcher` untouched. Any Redis error (unset config, outage, bad JSON)
 * degrades to calling `fetcher` directly rather than breaking the page —
 * Redis is a performance layer, never a hard dependency.
 *
 * A `null` from `fetcher` is cached under `negativeTtlSeconds`, which is short
 * on purpose: it bounds enumeration cost without making a newly published site
 * wait out the full positive TTL. Publishing also invalidates explicitly.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
  negativeTtlSeconds = 60
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T | typeof NEGATIVE>(key);
    if (hit === NEGATIVE) return null;
    if (hit !== null && hit !== undefined) return hit as T;
  } catch (error) {
    console.error(`[cache] read failed for "${key}", falling back to source.`, error);
    return fetcher();
  }

  const value = await fetcher();
  const isAbsent = value === null || value === undefined;

  redis
    .set(key, isAbsent ? NEGATIVE : value, {
      ex: isAbsent ? negativeTtlSeconds : ttlSeconds,
    })
    .catch((error) => {
      console.error(`[cache] write failed for "${key}".`, error);
    });

  return isAbsent ? null : value;
}

function siteCacheKeys(slug: string): string[] {
  return [`site:${slug}:published`, `site:${slug}:sermons`, `site:${slug}:events`];
}

/** Call whenever a site's published data, sermons, or events change. */
export async function invalidateSiteCache(slug: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(...siteCacheKeys(slug));
  } catch (error) {
    console.error(`[cache] invalidation failed for slug "${slug}".`, error);
  }
}

/** Hostname → slug entries, dropped when a custom domain changes. */
export async function invalidateHostnameCache(hostnames: string[]): Promise<void> {
  if (hostnames.length === 0) return;
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(...hostnames.map((hostname) => `host:${hostname.toLowerCase()}`));
  } catch (error) {
    console.error(`[cache] hostname invalidation failed.`, error);
  }
}
