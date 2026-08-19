
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAiBudget, getAiBudget } from "@/lib/ai/usage";
import { runChatTurn } from "@/lib/ai/chat/graph";
import type { ChatTurn } from "@/lib/ai/editor-prompt";
import { coerceSections } from "@/lib/validation/section";
import { invalidateSite } from "@/lib/site/invalidate";
import type { SectionInstance } from "@/lib/site/types";
import { parseChurchStory, type DesignFeedback, type SiteImprovement } from "@/lib/site/story";

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
  /** Present only when the turn actually changed the site's sections. */
  sections?: SectionInstance[];
  improvements?: SiteImprovement[];
  designFeedback?: DesignFeedback[];
  mobileFeedback?: DesignFeedback[];
};

export async function sendChatMessage(
  siteId: string,
  userId: string,
  content: string
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

  const currentSections = coerceSections(site.sectionConfig) as SectionInstance[];

  try {
    const result = await runChatTurn({
      churchName: site.name,
      features: (site.featureConfig as Record<string, unknown>) ?? {},
      sections: currentSections,
      history,
      message: trimmed,
    });

    let updatedSections: SectionInstance[] | undefined;

    if (result.updatedSections) {
      // Model output, repaired rather than trusted — same rule as every
      // other AI write path in this app.
      updatedSections = coerceSections(result.updatedSections) as SectionInstance[];
      await prisma.site.update({
        where: { id: siteId },
        data: {
          sectionConfig: toJson(updatedSections),
          // Persisted, not just returned to the client: the "Needs" checklist
          // in the editor reads this back from the site record, so a chat
          // edit's improvements/feedback have to survive a page reload the
          // same way the one-shot editor prompt's always did.
          storyConfig: toJson({
            ...parseChurchStory(site.storyConfig),
            improvements: result.improvements,
            designFeedback: result.designFeedback,
            mobileFeedback: result.mobileFeedback,
          }),
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
      sections: updatedSections,
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
