import { describe, expect, it, vi } from "vitest";

/**
 * The chatbot's budget callback must actually reach `runPageEdit`.
 *
 * `runChatTurn` accepted an `assertBudget` callback and `lib/chat/service.ts`
 * passed one, but `compiledGraph.invoke()` keeps only the keys the graph's
 * Annotation names — so the callback was dropped on the way in and
 * `applyChange` called `runPageEdit` without it. When the model retargeted to
 * another page, `runPageEdit`'s SECOND provider call went through completely
 * ungated.
 *
 * What the fix buys, precisely: that second call now consumes a cooldown
 * token and is re-checked against both limits, so a retarget storm is caught.
 * It does NOT make the second call cost monthly quota — the ledger counts one
 * row per request and nothing increments between the two calls — which is a
 * separate decision about how a retarget should be priced, not something this
 * wiring can settle.
 *
 * None of it is visible from outside: the reply looks right and the edit
 * lands. So the wiring gets a test rather than a comment.
 */
const pageEditCalls: Array<Record<string, unknown>> = [];

vi.mock("@/lib/ai/page-edit", () => ({
  runPageEdit: async (args: Record<string, unknown>) => {
    pageEditCalls.push(args);
    return {
      path: "/",
      blocks: [],
      changed: false,
      previousBlocks: [],
      previousPageExisted: true,
      summary: "No change was made.",
      improvements: [],
      designFeedback: [],
      mobileFeedback: [],
    };
  },
}));

// The classifier's provider call is not what's under test; stub it to route
// straight down the edit branch.
vi.mock("@/lib/ai/agents/model-config", () => ({
  resolveGateway: () => ({ provider: "test" }),
  buildRoleLlm: () => ({
    withStructuredOutput: () => async () => ({ intent: "edit" as const }),
  }),
}));

const { runChatTurn } = await import("@/lib/ai/chat/graph");

describe("runChatTurn", () => {
  it("hands its budget callback to runPageEdit", async () => {
    const assertBudget = vi.fn(async () => {});

    await runChatTurn({
      churchName: "Grace Chapel",
      siteId: "site-1",
      features: {},
      path: "/",
      blocks: [],
      history: [],
      message: "change the heading on the about page",
      assertBudget,
    });

    expect(pageEditCalls).toHaveLength(1);
    // The identity matters, not just presence: `runPageEdit` re-runs this
    // before a retarget's second call, so a different or absent function
    // means that call goes unbilled.
    expect(pageEditCalls[0]).toMatchObject({ siteId: "site-1", assertBudget });
  });
});
