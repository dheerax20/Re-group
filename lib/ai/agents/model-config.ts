import type { ClientOptions } from "openai";

/**
 * Which LLM answers each of the crew's six agents, and where the request
 * goes. Nothing here changes behavior until you opt in — every role
 * defaults to "gpt-4o-mini" against OpenAI directly, exactly what ran
 * before this file existed. Two independent, env-driven knobs layer on top,
 * so a cost or quality change is a deploy, never a code change.
 */

export type AgentRole =
  | "producer"
  | "themeDirector"
  | "layoutArchitect"
  | "copywriter"
  | "responsiveQa"
  | "mediaDirector";

const ROLE_ENV_VAR: Record<AgentRole, string> = {
  producer: "AI_MODEL_PRODUCER",
  themeDirector: "AI_MODEL_THEME_DIRECTOR",
  layoutArchitect: "AI_MODEL_LAYOUT_ARCHITECT",
  copywriter: "AI_MODEL_COPYWRITER",
  responsiveQa: "AI_MODEL_RESPONSIVE_QA",
  mediaDirector: "AI_MODEL_MEDIA_DIRECTOR",
};

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * The model name for one agent. Independently overridable per role — e.g.
 * keep five agents on a small model and give only the copywriter (the one
 * agent whose output a visitor actually reads) a stronger one:
 *
 *   AI_MODEL_COPYWRITER=gpt-4o
 *
 * Under AI_PROVIDER=openrouter, values must use OpenRouter's "vendor/model"
 * naming (e.g. "meta-llama/llama-3.1-8b-instruct", "anthropic/claude-3.5-haiku")
 * — OpenRouter's catalog does not share OpenAI's plain model names.
 */
export function modelForRole(role: AgentRole): string {
  return process.env[ROLE_ENV_VAR[role]]?.trim() || DEFAULT_MODEL;
}

export type Gateway = { apiKey: string; configuration?: ClientOptions };

/**
 * The API key and base URL the whole crew talks to for this build. One
 * gateway per build, not per agent: OpenRouter alone already reaches many
 * providers and small models behind a single key, so switching gateways
 * per-role would mean juggling a second API key for a benefit nothing here
 * needs yet. `AI_MODEL_<ROLE>` already gives per-agent variety within
 * whichever gateway is active.
 *
 * Returns null when nothing is configured — the caller decides what that
 * means (the site-generation crew treats it as "AI is off").
 */
export function resolveGateway(): Gateway | null {
  const provider = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    return {
      apiKey,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? { apiKey } : null;
}
