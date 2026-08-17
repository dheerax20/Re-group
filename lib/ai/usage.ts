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

/**
 * Chat messages. This is the request-based "credit" ceiling for the site
 * chatbot: a flat monthly quota per site, tunable per deployment without a
 * redeploy. Not every message costs the same underneath (a plain question is
 * one small classify call; an edit is classify + the same generation call
 * `editor_prompt` uses) but billing at the coarser "one message" grain is
 * what a church actually reasons about, so that's what's metered.
 */
const MONTHLY_CHAT_LIMIT = () => intFromEnv("AI_MONTHLY_CHAT_LIMIT", 300);

export type AiJobKind = "full_build" | "editor_prompt" | "chat_message";

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

/**
 * Chat messages live in `ChatMessage`, not `SiteGenerationJob` — only the
 * USER side counts, since that's "one request" from the church's point of
 * view regardless of whether the reply was a plain answer or a site edit.
 */
async function countUsage(siteId: string, kind: AiJobKind, since: Date): Promise<number> {
  if (kind === "chat_message") {
    return prisma.chatMessage.count({
      where: { siteId, role: "USER", createdAt: { gte: since } },
    });
  }
  return prisma.siteGenerationJob.count({
    where: { siteId, kind, createdAt: { gte: since } },
  });
}

function monthlyLimitFor(kind: AiJobKind): number {
  if (kind === "full_build") return MONTHLY_BUILD_LIMIT();
  if (kind === "chat_message") return MONTHLY_CHAT_LIMIT();
  return MONTHLY_PROMPT_LIMIT();
}

export async function getAiBudget(siteId: string, kind: AiJobKind): Promise<AiBudget> {
  const since = startOfMonth();
  const used = await countUsage(siteId, kind, since);
  const limit = monthlyLimitFor(kind);

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    resetsAt: new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + 1, 1)),
  };
}

/**
 * Cooldowns: short window, generous enough for real use. Chat gets the most
 * headroom of the three — a real conversation is naturally back-and-forth in
 * a way a single edit or a full rebuild never is.
 */
const COOLDOWN: Record<AiJobKind, { limit: number; windowSeconds: number; what: string }> = {
  full_build: { limit: 3, windowSeconds: 600, what: "website rebuilds" },
  editor_prompt: { limit: 12, windowSeconds: 300, what: "AI edits" },
  chat_message: { limit: 20, windowSeconds: 300, what: "chat messages" },
};

const KIND_LABEL: Record<AiJobKind, string> = {
  full_build: "AI website builds",
  editor_prompt: "AI edits",
  chat_message: "chat messages",
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
      `You have used all ${budget.limit} ${KIND_LABEL[kind]} for this month. Your allowance resets on ${resets}.`
    );
  }

  return budget;
}
