
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAiBudget, getAiBudget } from "@/lib/ai/usage";
import { runChatTurn } from "@/lib/ai/chat/graph";
import type { ChatTurn } from "@/lib/ai/block-prompt";
import { invalidateSite } from "@/lib/site/invalidate";
import { getPageBlocks, HOME_PATH } from "@/lib/site/blocks/resolve-page";
import { isEditablePath } from "@/lib/site/pages";
import { loadSiteConfig, writePageBlocks } from "@/lib/ai/page-edit";
import type { PageBlocks } from "@/lib/site/blocks/types";
import { withStoryFeedback, type DesignFeedback, type SiteImprovement } from "@/lib/site/story";

/**
 * The site chatbot's server boundary.
 *
 * One growing conversation per site (see the `ChatMessage` model comment).
 * Every message is budget-gated the same way the AI build and one-shot
 * editor prompt already are (`lib/ai/usage.ts`) — the "chat_message" kind
 * meters USER messages sent, since that's the unit a church actually reasons
 * about as "a request," regardless of whether the reply underneath was a
 * plain answer or a site edit.
 */

/** Recent turns fed to the model as context. Keeps the prompt bounded regardless of how long a thread gets. */
const HISTORY_TURNS = 8;

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  appliedSummary: string | null;
  createdAt: string;
};

function toView(row: {
  id: string;
  role: string;
  content: string;
  appliedSummary: string | null;
  createdAt: Date;
}): ChatMessageView {
  return {
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
    appliedSummary: row.appliedSummary,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getChatHistory(siteId: string): Promise<ChatMessageView[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

export async function getChatBudget(siteId: string) {
  const budget = await getAiBudget(siteId, "chat_message");
  return {
    used: budget.used,
    limit: budget.limit,
    remaining: budget.remaining,
    resetsAt: budget.resetsAt.toISOString(),
  };
}

export type SendChatMessageResult = {
  userMessage: ChatMessageView;
  assistantMessage: ChatMessageView;
  /** Present only when the turn actually changed the site's page. */
  blocks?: PageBlocks;
  /** Which page changed — not always the one the editor was showing. */
  path?: string;
  improvements?: SiteImprovement[];
  designFeedback?: DesignFeedback[];
  mobileFeedback?: DesignFeedback[];
};

export async function sendChatMessage(
  siteId: string,
  userId: string,
  content: string,
  /** The page the editor is showing; the model may retarget from here. */
  path: string = HOME_PATH
): Promise<SendChatMessageResult> {
  // Authorized by `paidSiteProcedure`; `userId` is the caller it verified.

  const trimmed = content.trim();
  if (trimmed.length < 2) {
    throw new Error("Say a bit more so I know what you'd like.");
  }
  if (trimmed.length > 1000) {
    throw new Error("Keep messages under 1000 characters.");
  }

  // Checked before anything is written: a rejected message should leave no
  // trace in the thread, not a user bubble with no reply.
  await assertAiBudget(siteId, userId, "chat_message");

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const recentRows = await prisma.chatMessage.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
  });
  const history: ChatTurn[] = recentRows
    .reverse()
    .map((row) => ({ role: row.role === "USER" ? "user" : "assistant", content: row.content }));

  const userMessage = await prisma.chatMessage.create({
    data: { siteId, role: "USER", content: trimmed },
  });

  // The tree the selected page actually renders. `runPageEdit` re-resolves it
  // anyway; this copy is what the read-only `answerQuestion` branch describes.
  const { siteConfig } = await loadSiteConfig(siteId);
  const currentPath = isEditablePath(path, siteConfig.features) ? path : HOME_PATH;
  const currentBlocks = getPageBlocks(siteConfig, currentPath);

  try {
    const result = await runChatTurn({
      siteId,
      churchName: site.name,
      features: (site.featureConfig as Record<string, unknown>) ?? {},
      path: currentPath,
      blocks: currentBlocks,
      history,
      message: trimmed,
      // A retarget costs a second provider call, and the budget is asserted
      // per call, not per request.
      assertBudget: () => assertAiBudget(siteId, userId, "chat_message").then(() => undefined),
    });

    let updatedBlocks: PageBlocks | undefined;
    const updatedPath = result.updatedPath ?? currentPath;

    if (result.updatedBlocks) {
      // Already repaired by `applyBlockEdits` (coerceBlocks + the legibility
      // pass) — model output is never written unrepaired, on either path.
      updatedBlocks = result.updatedBlocks;
      // Home lands on `Site.blockConfig`; every other page on its `SitePage`
      // row. `writePageBlocks` owns that split.
      await writePageBlocks(siteId, updatedPath, updatedBlocks);
      await prisma.site.update({
        where: { id: siteId },
        data: {
          // Persisted, not just returned to the client: the "Needs" checklist
          // in the editor reads this back from the site record, so a chat
          // edit's improvements/feedback have to survive a page reload the
          // same way the one-shot editor prompt's always did.
          storyConfig: toJson(
            withStoryFeedback(site.storyConfig, {
              improvements: result.improvements,
              designFeedback: result.designFeedback,
              mobileFeedback: result.mobileFeedback,
            })
          ),
        },
      });
      await invalidateSite(siteId);
    }

    const assistantRow = await prisma.chatMessage.create({
      data: {
        siteId,
        role: "ASSISTANT",
        content: result.reply,
        appliedSummary: result.appliedSummary ?? null,
      },
    });

    return {
      userMessage: toView(userMessage),
      assistantMessage: toView(assistantRow),
      blocks: updatedBlocks,
      path: updatedPath,
      improvements: result.improvements,
      designFeedback: result.designFeedback,
      mobileFeedback: result.mobileFeedback,
    };
  } catch (error) {
    console.error("[sendChatMessage]", error);
    const message = error instanceof Error ? error.message : "The chat assistant failed";

    // A failure still gets a reply in the thread — a user message with no
    // response ever showing up again is worse than an honest error bubble,
    // and the budget check above already reserved this turn regardless of
    // whether the provider call that follows succeeds.
    const assistantRow = await prisma.chatMessage.create({
      data: {
        siteId,
        role: "ASSISTANT",
        content: `Sorry, I couldn't do that: ${message.slice(0, 200)}`,
      },
    });

    return {
      userMessage: toView(userMessage),
      assistantMessage: toView(assistantRow),
    };
  }
}
