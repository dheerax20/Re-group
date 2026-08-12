import { Redis } from "@upstash/redis";

/**
 * Upstash's REST client is fetch-based — no persistent TCP connection to
 * exhaust across serverless invocations, unlike ioredis.
 */
let client: Redis | null | undefined;

function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/**
 * Cache-aside read: serve from Redis when available, otherwise fall through
 * to `fetcher` untouched. Any Redis error (unset config, outage, bad JSON)
 * degrades to calling `fetcher` directly rather than breaking the page —
 * Redis is a performance layer, never a hard dependency.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.error(`[cache] read failed for "${key}", falling back to source.`, error);
    return fetcher();
  }

  const value = await fetcher();

  redis.set(key, value, { ex: ttlSeconds }).catch((error) => {
    console.error(`[cache] write failed for "${key}".`, error);
  });

  return value;
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
