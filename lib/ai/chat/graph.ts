import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";
import type { ChatTurn } from "@/lib/ai/block-prompt";
import { runPageEdit } from "@/lib/ai/page-edit";
import { describeBlocks } from "@/lib/site/blocks/patch";
import type { PageBlocks } from "@/lib/site/blocks/types";
import { buildRoleLlm, resolveGateway } from "@/lib/ai/agents/model-config";
import { chatAnswerSchema, classifyResultSchema } from "./schemas";

/**
 * The site chatbot, as a small LangGraph.
 *
 * This is the first real graph in the codebase — everywhere else (the
 * six-agent site-generation crew) is a fixed linear pipeline with one
 * parallel branch, which hand-written control flow already handles fine.
 * A chat turn is different: whether to touch the site at all depends on what
 * the message actually says, which is exactly the kind of branch a graph's
 * conditional edges are for rather than an if/else bolted onto a chain.
 *
 * The `applyChange` node calls `applyBlockAiPrompt` — the SAME function the
 * editor's one-shot "AI prompt" box uses, which runs every output through
 * `applyBlockPatches` (and so `coerceBlocks`) at the write site. The chatbot is
 * not a second, less validated way to touch a site's content; it is a second
 * way to reach the same one.
 */

const ChatState = Annotation.Root({
  siteId: Annotation<string>,
  churchName: Annotation<string>,
  features: Annotation<Record<string, unknown>>,
  /** The page the editor is showing. `applyChange` may retarget from here. */
  path: Annotation<string>,
  blocks: Annotation<PageBlocks>,
  history: Annotation<ChatTurn[]>,
  message: Annotation<string>,
  intent: Annotation<"edit" | "question">,
  reply: Annotation<string>,
  updatedBlocks: Annotation<PageBlocks | undefined>,
  /** The page actually edited — not always the one being viewed. */
  updatedPath: Annotation<string | undefined>,
  appliedSummary: Annotation<string | undefined>,
  improvements: Annotation<SiteImprovement[] | undefined>,
  designFeedback: Annotation<DesignFeedback[] | undefined>,
  mobileFeedback: Annotation<DesignFeedback[] | undefined>,
});

type ChatStateType = typeof ChatState.State;

/**
  * A short, human-readable snapshot of what the site currently says.
  *
  * Built from the BLOCK tree, not from `sectionConfig`. `commitBuild` only
  * writes `sectionConfig` when the crew produced no blocks, so on an AI-built
  * site that column still holds pre-AI wizard leftovers — the assistant was
  * describing and answering questions about a page that had not been live for
  * some time.
  */
export function summarizeBlocks(blocks: PageBlocks): string {
  return describeBlocks(blocks);
}

export function historyBlock(history: ChatTurn[]): string {
  if (history.length === 0) return "(no earlier messages)";
  return history.map((turn) => `${turn.role === "user" ? "Pastor/admin" : "Assistant"}: ${turn.content}`).join("\n");
}

async function classify(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const gateway = resolveGateway();
  if (!gateway) throw new Error("No AI provider is configured (set OPENAI_API_KEY).");

  const llm = buildRoleLlm(gateway, "chatClassifier", 0.1);
  const chain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      [
        "system",
        "Decide whether the pastor/admin's message is asking to CHANGE something about their church " +
          "website (copy, wording, layout style, colors mentioned in words, which sections show) versus " +
          "asking a QUESTION or making conversation that needs an answer but no change. " +
          "If the message is ambiguous, choose 'edit' only when there is a clear, actionable request; " +
          "otherwise choose 'question'.",
      ],
      ["human", "Recent conversation:\n{history}\n\nMessage:\n{message}"],
    ]),
    llm.withStructuredOutput(classifyResultSchema, { name: "classify_intent" }),
  ]);

  const result = await chain.invoke({
    history: historyBlock(state.history),
    message: state.message,
  });

  return { intent: result.intent };
}

async function applyChange(state: ChatStateType): Promise<Partial<ChatStateType>> {
  // `runPageEdit` is the same function the editor's prompt box calls, so the
  // chatbot stays a second DOOR to one write path rather than a second write
  // path — and it inherits page resolution and retargeting for free.
  const result = await runPageEdit({
    siteId: state.siteId,
    path: state.path,
    prompt: state.message,
    history: state.history,
  });

  const summary = result.summary;

  return {
    // Nothing usable means nothing changed; leaving this undefined is what
    // keeps the caller from writing an identical tree and showing an
    // "Applied" badge for an edit that did not happen.
    updatedBlocks: result.changed ? result.blocks : undefined,
    updatedPath: result.changed ? result.path : undefined,
    appliedSummary: result.changed ? summary : undefined,
    reply: summary,
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}

async function answerQuestion(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const gateway = resolveGateway();
  if (!gateway) throw new Error("No AI provider is configured (set OPENAI_API_KEY).");

  const llm = buildRoleLlm(gateway, "chatAnswer", 0.4);
  const chain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful assistant for a church website builder, answering a pastor or admin's " +
          "question about their own site. Answer only from the site snapshot and conversation given — " +
          "never invent facts about the church, and never claim to have changed anything (you cannot; " +
          "this is a read-only answer). If the question actually wants a change made, say so plainly and " +
          "ask them to rephrase it as a request (e.g. 'change the hero text to ...'). Keep it brief.",
      ],
      [
        "human",
        "Church: {churchName}\n\nCurrent site:\n{siteSnapshot}\n\nRecent conversation:\n{history}\n\n" +
          "Message:\n{message}",
      ],
    ]),
    llm.withStructuredOutput(chatAnswerSchema, { name: "chat_answer" }),
  ]);

  const result = await chain.invoke({
    churchName: state.churchName,
    siteSnapshot: summarizeBlocks(state.blocks),
    history: historyBlock(state.history),
    message: state.message,
  });

  return { reply: result.reply };
}

export function routeByIntent(state: Pick<ChatStateType, "intent">): "applyChange" | "answerQuestion" {
  return state.intent === "edit" ? "applyChange" : "answerQuestion";
}

const compiledGraph = new StateGraph(ChatState)
  .addNode("classify", classify)
  .addNode("applyChange", applyChange)
  .addNode("answerQuestion", answerQuestion)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", routeByIntent, ["applyChange", "answerQuestion"])
  .addEdge("applyChange", END)
  .addEdge("answerQuestion", END)
  .compile();

export type ChatTurnResult = {
  reply: string;
  intent: "edit" | "question";
  updatedBlocks?: PageBlocks;
  updatedPath?: string;
  appliedSummary?: string;
  improvements?: SiteImprovement[];
  designFeedback?: DesignFeedback[];
  mobileFeedback?: DesignFeedback[];
};

export async function runChatTurn(input: {
  churchName: string;
  siteId: string;
  features: Record<string, unknown>;
  path: string;
  blocks: PageBlocks;
  history: ChatTurn[];
  message: string;
  /** Re-run before a retarget's second provider call. */
  assertBudget?: () => Promise<void>;
}): Promise<ChatTurnResult> {
  if (!resolveGateway()) {
    throw new Error("No AI provider is configured (set OPENAI_API_KEY).");
  }

  const result = await compiledGraph.invoke(input);
  return {
    reply: result.reply,
    intent: result.intent,
    updatedBlocks: result.updatedBlocks,
    updatedPath: result.updatedPath,
    appliedSummary: result.appliedSummary,
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}
