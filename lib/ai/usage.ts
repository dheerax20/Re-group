import { prisma } from "@/lib/db";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

/**
 * The ceiling on AI spend.
 *
 * Two layers, deliberately. A Redis cooldown stops the accidental storm — a
 * refresh loop, a double-clicked Regenerate — and fails open, because a cache
 * outage must not lock a church out of its own editor. A Postgres row count
 * enforces the monthly budget and cannot be reset by flushing a cache, which is
 * what makes it safe to expose a button that spends money on every press.
 *
 * Counting rows in `SiteGenerationJob` rather than keeping a separate counter
 * means the ledger and the audit trail are the same record; a job that failed
 * still counts, because the provider was still called.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Full six-agent builds. Each one is six LLM calls, so the cap is low. */
const MONTHLY_BUILD_LIMIT = () => intFromEnv("AI_MONTHLY_BUILD_LIMIT", 25);

/** Single-call editor prompts. Cheaper, so a working allowance is higher. */
const MONTHLY_PROMPT_LIMIT = () => intFromEnv("AI_MONTHLY_PROMPT_LIMIT", 150);

export type AiJobKind = "full_build" | "editor_prompt";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type AiBudget = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
};

export async function getAiBudget(siteId: string, kind: AiJobKind): Promise<AiBudget> {
  const since = startOfMonth();
  const used = await prisma.siteGenerationJob.count({
    where: { siteId, kind, createdAt: { gte: since } },
  });
  const limit = kind === "full_build" ? MONTHLY_BUILD_LIMIT() : MONTHLY_PROMPT_LIMIT();

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    resetsAt: new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + 1, 1)),
  };
}

/** Cooldowns: short window, generous enough for real editing. */
const COOLDOWN: Record<AiJobKind, { limit: number; windowSeconds: number; what: string }> = {
  full_build: { limit: 3, windowSeconds: 600, what: "website rebuilds" },
  editor_prompt: { limit: 12, windowSeconds: 300, what: "AI edits" },
};

/**
 * Throws unless this site may spend another AI call right now. Call before any
 * provider request, never after — the point is to not make the call.
 */
export async function assertAiBudget(
  siteId: string,
  userId: string,
  kind: AiJobKind
): Promise<AiBudget> {
  const cooldown = COOLDOWN[kind];
  await enforceRateLimit(
    `ai:${kind}:${userId}`,
    cooldown.limit,
    cooldown.windowSeconds,
    cooldown.what
  );

  const budget = await getAiBudget(siteId, kind);
  if (budget.remaining <= 0) {
    const resets = budget.resetsAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    throw new RateLimitError(
      kind === "full_build"
        ? `You have used all ${budget.limit} AI website builds for this month. Your allowance resets on ${resets}.`
        : `You have used all ${budget.limit} AI edits for this month. Your allowance resets on ${resets}.`
    );
  }

  return budget;
}
