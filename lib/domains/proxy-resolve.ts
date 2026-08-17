import { hostnameCacheKey, HOSTNAME_NEGATIVE_TTL_SECONDS, HOSTNAME_TTL_SECONDS } from "./resolve";

/**
 * Hostname resolution as the proxy can perform it.
 *
 * The proxy cannot use Prisma — Next.js may run it outside the app runtime, and
 * the docs warn against depending on shared modules there. So this file talks to
 * Upstash over plain `fetch` (no client library, nothing stateful) and falls
 * back to an internal route handler that owns the database query.
 *
 * Everything here fails soft: if neither Redis nor the resolver route answers,
 * the request falls through to normal routing and the visitor sees the platform
 * 404 rather than a proxy error.
 */

const NEGATIVE = "__regroup_absent__";

type RedisConfig = { url: string; token: string };

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function redisGet(config: RedisConfig, key: string): Promise<string | null> {
  const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { result: string | null };
  return body.result;
}

async function redisSet(
  config: RedisConfig,
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  await fetch(
    `${config.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    }
  );
}

/**
 * Upstash stores what `@upstash/redis` wrote, which is JSON. A slug cached by
 * the app layer therefore arrives as `{"slug":"grace"}`, while this file writes
 * bare strings. Read both shapes.
 */
function readCachedSlug(raw: string): string | null {
  if (raw === NEGATIVE) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { slug?: unknown };
      return typeof parsed.slug === "string" ? parsed.slug : null;
    } catch {
      return null;
    }
  }
  return raw.replace(/^"|"$/g, "") || null;
}

async function askResolverRoute(
  hostname: string,
  origin: string
): Promise<string | null | undefined> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return undefined;

  try {
    const response = await fetch(
      `${origin}/api/internal/hostname?host=${encodeURIComponent(hostname)}`,
      { headers: { "x-internal-secret": secret }, cache: "no-store" }
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as { slug: string | null };
    return body.slug;
  } catch (error) {
    console.error(`[proxy] hostname resolver failed for ${hostname}`, error);
    return undefined;
  }
}

/**
 * The slug serving `hostname`, or null when nothing does.
 *
 * `undefined` is not returned — an unresolvable hostname and an unavailable
 * resolver are both "do not rewrite", and the caller treats them the same.
 */
export async function resolveHostnameInProxy(
  hostname: string,
  origin: string
): Promise<string | null> {
  const config = redisConfig();
  const key = hostnameCacheKey(hostname);

  if (config) {
    try {
      const hit = await redisGet(config, key);
      if (hit !== null) return readCachedSlug(hit);
    } catch (error) {
      console.error(`[proxy] hostname cache read failed for ${hostname}`, error);
    }
  }

  const slug = await askResolverRoute(hostname, origin);
  if (slug === undefined) return null;

  if (config) {
    redisSet(
      config,
      key,
      slug ? JSON.stringify({ slug }) : NEGATIVE,
      slug ? HOSTNAME_TTL_SECONDS : HOSTNAME_NEGATIVE_TTL_SECONDS
    ).catch((error) => {
      console.error(`[proxy] hostname cache write failed for ${hostname}`, error);
    });
  }

  return slug;
}
