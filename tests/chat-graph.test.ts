import { describe, expect, it } from "vitest";
import { historyBlock, routeByIntent, summarizeSections } from "@/lib/ai/chat/graph";
import { chatAnswerSchema, classifyResultSchema } from "@/lib/ai/chat/schemas";
import type { SectionInstance } from "@/lib/site/types";
import type { ChatTurn } from "@/lib/ai/editor-prompt";

/**
 * The pure, non-LLM-calling parts of the chat graph. The graph itself
 * (classify -> applyChange | answerQuestion) can't be exercised end-to-end
 * without a real model call, but its routing decision and the context it
 * builds for every node are ordinary functions and are tested as such.
 */

describe("routeByIntent", () => {
  it("sends an edit request to applyChange", () => {
    expect(routeByIntent({ intent: "edit" })).toBe("applyChange");
  });

  it("sends everything else to answerQuestion", () => {
    expect(routeByIntent({ intent: "question" })).toBe("answerQuestion");
  });
});

describe("summarizeSections", () => {
  const sections: SectionInstance[] = [
    {
      id: "hero",
      type: "hero",
      variant: "cinematic",
      enabled: true,
      config: { title: "Welcome to Grace", description: "A place to gather." },
    },
    { id: "footer", type: "footer", variant: "standard", enabled: true, config: {} },
  ];

  it("includes each section's type, variant, and copy", () => {
    const summary = summarizeSections(sections);
    expect(summary).toContain("hero (cinematic)");
    expect(summary).toContain("Welcome to Grace");
    expect(summary).toContain("A place to gather.");
    expect(summary).toContain("footer (standard)");
  });

  it("does not throw on a section with no title or description", () => {
    expect(() => summarizeSections(sections)).not.toThrow();
  });

  it("returns an empty string for no sections rather than throwing", () => {
    expect(summarizeSections([])).toBe("");
  });
});

describe("historyBlock", () => {
  it("labels each turn by who sent it", () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "Make the hero warmer" },
      { role: "assistant", content: "Done — updated the hero copy." },
    ];
    const block = historyBlock(turns);
    expect(block).toContain("Pastor/admin: Make the hero warmer");
    expect(block).toContain("Assistant: Done — updated the hero copy.");
  });

  it("says plainly when there is no history, rather than an empty string", () => {
    // An empty string here would silently vanish from the prompt template;
    // an explicit placeholder is what keeps the model from assuming context
    // that was never given.
    expect(historyBlock([])).toBe("(no earlier messages)");
  });
});

describe("classifyResultSchema", () => {
  it("accepts the two real intents", () => {
    expect(classifyResultSchema.safeParse({ intent: "edit" }).success).toBe(true);
    expect(classifyResultSchema.safeParse({ intent: "question" }).success).toBe(true);
  });

  it("rejects anything else, including a plausible-looking third option", () => {
    expect(classifyResultSchema.safeParse({ intent: "chat" }).success).toBe(false);
    expect(classifyResultSchema.safeParse({}).success).toBe(false);
  });
});

describe("chatAnswerSchema", () => {
  it("accepts a normal reply", () => {
    expect(chatAnswerSchema.safeParse({ reply: "Your hero says 'Welcome to Grace'." }).success).toBe(
      true
    );
  });

  it("rejects an empty reply", () => {
    expect(chatAnswerSchema.safeParse({ reply: "" }).success).toBe(false);
  });

  it("rejects a reply over the length cap", () => {
    expect(chatAnswerSchema.safeParse({ reply: "a".repeat(601) }).success).toBe(false);
  });
});
