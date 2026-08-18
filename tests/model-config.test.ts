import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelForRole, resolveGateway } from "@/lib/ai/agents/model-config";

/**
 * The one hard requirement for this module: nothing about model routing may
 * change behavior unless an env var explicitly opts in. Getting this wrong
 * would either silently change what every church's site costs to generate,
 * or silently degrade quality — neither should ever happen from a refactor.
 */

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "AI_MODEL_PRODUCER",
  "AI_MODEL_COPYWRITER",
  "AI_MODEL_EDITOR",
  "AI_MODEL_CHAT_CLASSIFIER",
  "AI_MODEL_CHAT_ANSWER",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("modelForRole", () => {
  it("defaults every role to gpt-4o-mini with nothing configured", () => {
    expect(modelForRole("producer")).toBe("gpt-4o-mini");
    expect(modelForRole("copywriter")).toBe("gpt-4o-mini");
  });

  it("overrides only the role its env var names", () => {
    process.env.AI_MODEL_COPYWRITER = "gpt-4o";
    expect(modelForRole("copywriter")).toBe("gpt-4o");
    expect(modelForRole("producer")).toBe("gpt-4o-mini");
  });

  it("ignores a blank override rather than sending an empty model name", () => {
    process.env.AI_MODEL_PRODUCER = "   ";
    expect(modelForRole("producer")).toBe("gpt-4o-mini");
  });

  it("covers the editor and chatbot roles independently of the crew's six", () => {
    process.env.AI_MODEL_EDITOR = "gpt-4o";
    process.env.AI_MODEL_CHAT_CLASSIFIER = "gpt-4o-mini";
    expect(modelForRole("editor")).toBe("gpt-4o");
    expect(modelForRole("chatClassifier")).toBe("gpt-4o-mini");
    // Untouched roles still default — one role's override must not bleed
    // into another's.
    expect(modelForRole("chatAnswer")).toBe("gpt-4o-mini");
    expect(modelForRole("producer")).toBe("gpt-4o-mini");
  });
});

describe("resolveGateway", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveGateway()).toBeNull();
  });

  it("resolves the OpenAI key with nothing else attached", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(resolveGateway()).toEqual({ apiKey: "sk-test" });
  });
});
