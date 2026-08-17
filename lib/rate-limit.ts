import { getRedis } from "@/lib/cache/redis";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. 0 when the request was allowed. */
  retryAfter: number;
};

const ALLOWED: RateLimitResult = { ok: true, remaining: Number.POSITIVE_INFINITY, retryAfter: 0 };

/**
 * Fixed-window counter in Redis.
 *
 * Fail-open by design: when Redis is unconfigured or down, requests are allowed
 * and the event is logged. That is the right trade for abuse throttles — a cache
 * outage must not lock every church out of their own editor. It is NOT sufficient
 * on its own for anything that costs money per call, which is why the AI budget
 * is additionally capped against Postgres in `lib/ai/usage.ts`, where the count
 * is authoritative and cannot be reset by flushing a cache.
 *
 * A fixed window admits up to 2x the limit across a window boundary. For
 * cooldowns and abuse ceilings that is immaterial; for a hard quota, count rows.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return ALLOWED;

  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;

  try {
    const count = await redis.incr(bucket);
    // Only the request that created the bucket needs to set the TTL. Doing it
    // every time would slide the window forward and never let it reset.
    if (count === 1) {
      await redis.expire(bucket, windowSeconds);
    }

    if (count > limit) {
      const ttl = await redis.ttl(bucket);
      return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }

    return { ok: true, remaining: limit - count, retryAfter: 0 };
  } catch (error) {
    console.error(`[rate-limit] check failed for "${key}", allowing.`, error);
    return ALLOWED;
  }
}

/** Human-readable wait, for error copy the user actually reads. */
export function describeRetryAfter(seconds: number): string {
  if (seconds <= 60) return `${Math.max(seconds, 1)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Thrown when a limit is hit. Server actions surface `message` to the client. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Applies a limit and throws with copy the user can act on. Use in server
 * actions; Route Handlers should read `rateLimit()` directly so they can return
 * a 429 with a `Retry-After` header.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  what: string
): Promise<void> {
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.ok) {
    throw new RateLimitError(
      `Too many ${what}. Try again in ${describeRetryAfter(result.retryAfter)}.`
    );
  }
}
