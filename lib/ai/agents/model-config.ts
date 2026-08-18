import { ChatOpenAI } from "@langchain/openai";

/**
 * Which OpenAI model answers each agent. Nothing here changes behavior until
 * you opt in — every role defaults to "gpt-4o-mini", exactly what ran before
 * this file existed. `AI_MODEL_<ROLE>` overrides one role independently of
 * the rest, so a cost or quality change is a deploy, never a code change.
 */

export type AgentRole =
  | "producer"
  | "themeDirector"
  | "layoutArchitect"
  | "copywriter"
  | "responsiveQa"
  | "mediaDirector"
  | "editor"
  | "chatClassifier"
  | "chatAnswer";

const ROLE_ENV_VAR: Record<AgentRole, string> = {
  producer: "AI_MODEL_PRODUCER",
  themeDirector: "AI_MODEL_THEME_DIRECTOR",
  layoutArchitect: "AI_MODEL_LAYOUT_ARCHITECT",
  copywriter: "AI_MODEL_COPYWRITER",
  responsiveQa: "AI_MODEL_RESPONSIVE_QA",
  mediaDirector: "AI_MODEL_MEDIA_DIRECTOR",
  // The in-editor one-shot prompt (lib/ai/editor-prompt.ts).
  editor: "AI_MODEL_EDITOR",
  // The site chatbot (lib/ai/chat) — two roles because "is this a question or
  // an edit request" is a much smaller job than answering or editing, and is
  // worth routing to a cheaper model independently of the other.
  chatClassifier: "AI_MODEL_CHAT_CLASSIFIER",
  chatAnswer: "AI_MODEL_CHAT_ANSWER",
};

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * The model name for one agent. Independently overridable per role — e.g.
 * keep five agents on the small default and give only the copywriter (the
 * one agent whose output a visitor actually reads) a stronger one:
 *
 *   AI_MODEL_COPYWRITER=gpt-4o
 */
export function modelForRole(role: AgentRole): string {
  return process.env[ROLE_ENV_VAR[role]]?.trim() || DEFAULT_MODEL;
}

export type Gateway = { apiKey: string };

/**
 * The OpenAI API key the whole crew talks to for this build.
 *
 * Returns null when nothing is configured — the caller decides what that
 * means (the site-generation crew treats it as "AI is off").
 */
export function resolveGateway(): Gateway | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? { apiKey } : null;
}

/**
 * One `ChatOpenAI` client for one role. Shared by every agent group in
 * `lib/ai` (the site-generation crew, the in-editor prompt, the chatbot) so a
 * role's model is decided in exactly one place.
 */
export function buildRoleLlm(gateway: Gateway, role: AgentRole, temperature: number): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: gateway.apiKey,
    model: modelForRole(role),
    temperature,
  });
}
