import { NextResponse, type NextRequest } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import type { slackEditTask } from "@/trigger/slack-edit";
import { isSlackCommandsEnabled } from "@/lib/slack/api";
import { parseCommand } from "@/lib/slack/commands";
import { failureMessage, type SlackMessage } from "@/lib/slack/blocks";
import {
  authorizeSlackActor,
  buildHelp,
  buildStatus,
  type SlackCommandContext,
} from "@/lib/slack/dispatch";
import { parseCommandBody, verifySlackRequest } from "@/lib/slack/verify";

export const runtime = "nodejs";

/**
 * `/regroup …`.
 *
 * Three seconds, total, to answer — Slack shows the church an error if this
 * takes longer, however well the edit itself goes. So the only work done here
 * is what is provably fast: verify the signature, read the row that decides
 * permission, and either answer outright or hand the edit to a durable run.
 *
 * Everything answered inline goes back in the 200 BODY rather than through
 * `response_url`. That costs no round-trip, needs no bot token, and still
 * works when the task runner is unreachable — which matters most for exactly
 * the messages that report something being wrong.
 *
 * No session, no cookies: `proxy.ts` returns this path before
 * `auth0.middleware()` so the body arrives byte-for-byte intact for the
 * signature check.
 */
function ephemeral(message: SlackMessage) {
  return NextResponse.json({
    response_type: "ephemeral",
    text: message.text,
    blocks: message.blocks,
  });
}

export async function POST(request: NextRequest) {
  if (!isSlackCommandsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const verified = await verifySlackRequest(request);
  if (!verified.ok) {
    console.warn(`[slack] command rejected (${verified.reason})`);
    return new NextResponse(null, { status: 401 });
  }

  const body = parseCommandBody(verified.rawBody);
  if (!body) {
    console.warn("[slack] command body was missing fields authorization depends on");
    return new NextResponse(null, { status: 400 });
  }

  const context: SlackCommandContext = {
    teamId: body.teamId,
    slackUserId: body.userId,
    channelId: body.channelId,
    responseUrl: body.responseUrl,
  };

  const command = parseCommand(body.text);
  if (command.kind === "invalid") {
    // A typo costs nothing: no lookup, no job row, no provider call.
    return ephemeral(failureMessage(command.message));
  }

  /**
   * Authorizing here rather than only in the task means a refusal never
   * starts a run, and the person sees it immediately instead of a second
   * later. The task re-authorizes anyway — it must not trust its payload, and
   * an entitlement can lapse between the two.
   */
  const auth = await authorizeSlackActor(context.teamId, context.slackUserId, context.channelId);
  if (!auth.ok) {
    return ephemeral(failureMessage(auth.message));
  }

  if (command.kind === "help") return ephemeral(await buildHelp(auth));
  if (command.kind === "status") return ephemeral(await buildStatus(auth));

  /**
   * Undo runs in the task too, not inline. It is several queries plus a
   * transaction, and blowing the three-second budget would show the church a
   * Slack error for an undo that then succeeds anyway.
   */
  const payload =
    command.kind === "undo"
      ? ({ action: "undo", context } as const)
      : ({ action: "prompt", context, prompt: command.prompt } as const);

  try {
    await tasks.trigger<typeof slackEditTask>("slack-edit", payload);
  } catch (error) {
    console.error("[slack] could not queue the command", error);
    return ephemeral(
      failureMessage("Regroup couldn't start that. Try again in a moment.")
    );
  }

  /**
   * Nothing in the body on the happy path.
   *
   * An "on it…" ephemeral here would be immediately followed by the same
   * sentence posted into the channel by the run, where the whole church can
   * see it. One message is clearer than two, and the channel one is the one
   * that gets edited in place with the result.
   */
  return new NextResponse(null, { status: 200 });
}
