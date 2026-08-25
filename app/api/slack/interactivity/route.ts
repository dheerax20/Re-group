import { NextResponse, type NextRequest } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import type { slackEditTask } from "@/trigger/slack-edit";
import { isSlackCommandsEnabled, respondViaResponseUrl } from "@/lib/slack/api";
import { UNDO_ACTION_ID, failureMessage } from "@/lib/slack/blocks";
import { authorizeSlackActor, type SlackCommandContext } from "@/lib/slack/dispatch";
import { parseInteractionBody, verifySlackRequest } from "@/lib/slack/verify";

export const runtime = "nodejs";

/**
 * Block Kit buttons — currently just Undo.
 *
 * The rule that shapes this route: a button sitting in a channel is clickable
 * by everyone who can see the channel, and its payload tells us who clicked,
 * never who is entitled to. So the CLICKER is authorized from scratch here,
 * exactly as a fresh slash command would be. Nothing about having been the
 * person who ran the original edit carries over, and nothing about the
 * button's own payload is trusted beyond naming which job it refers to.
 *
 * Slack allows three seconds, so the acknowledgement is empty and immediate
 * and the work goes to the same durable run the slash command uses.
 */
export async function POST(request: NextRequest) {
  if (!isSlackCommandsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const verified = await verifySlackRequest(request);
  if (!verified.ok) {
    console.warn(`[slack] interaction rejected (${verified.reason})`);
    return new NextResponse(null, { status: 401 });
  }

  const interaction = parseInteractionBody(verified.rawBody);
  if (!interaction) {
    // A payload shape this app does not publish. Acknowledged rather than
    // refused, because Slack retries anything that is not a prompt 2xx.
    return new NextResponse(null, { status: 200 });
  }

  if (interaction.actionId !== UNDO_ACTION_ID) {
    return new NextResponse(null, { status: 200 });
  }

  const context: SlackCommandContext = {
    teamId: interaction.teamId,
    slackUserId: interaction.userId,
    channelId: interaction.channelId,
    responseUrl: interaction.responseUrl,
  };

  const auth = await authorizeSlackActor(
    context.teamId,
    context.slackUserId,
    context.channelId
  );

  if (!auth.ok) {
    /**
     * Ephemeral, so the refusal is seen only by whoever pressed the button.
     * The message everyone else can see is left exactly as it was — a
     * bystander clicking Undo must not visibly alter the channel.
     */
    const message = failureMessage(auth.message);
    await respondViaResponseUrl(context.responseUrl, message.text, message.blocks);
    return new NextResponse(null, { status: 200 });
  }

  try {
    await tasks.trigger<typeof slackEditTask>("slack-edit", {
      action: "undo",
      context,
      // Undo THIS edit, not merely the most recent one. The two differ the
      // moment someone scrolls back to an older result message.
      jobId: interaction.value ?? undefined,
      sourceMessageTs: interaction.messageTs ?? undefined,
    });
  } catch (error) {
    console.error("[slack] could not queue the undo", error);
    const message = failureMessage("Regroup couldn't undo that. Try again in a moment.");
    await respondViaResponseUrl(context.responseUrl, message.text, message.blocks);
  }

  /**
   * A double-click needs no de-duplication here: the second run finds
   * `revertedAt` already set and answers "that edit has already been undone".
   * Once-only semantics fall out of the data rather than out of a cache.
   */
  return new NextResponse(null, { status: 200 });
}
