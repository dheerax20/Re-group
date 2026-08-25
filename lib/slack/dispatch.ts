import { prisma } from "@/lib/db";
import { runEditorPromptJob } from "@/lib/ai/editor-prompt-run";
import { revertPageEdit } from "@/lib/ai/revert-page-edit";
import { getAiBudget } from "@/lib/ai/usage";
import { canonicalHostForSite } from "@/lib/domains/actions-support";
import { SITE_PAGE_LINKS } from "@/lib/site/pages";
import { authorizeSlackActor, type SlackActorAuthorization } from "./authorize";
import { postMessage, respondViaResponseUrl, updateMessage } from "./api";
import { decryptToken } from "./crypto";
import {
  editResultMessage,
  failureMessage,
  helpMessage,
  revertedMessage,
  statusMessage,
  workingMessage,
  type SlackMessage,
} from "./blocks";

/**
 * What actually happens when someone runs `/regroup …`.
 *
 * One function per action, and both entry points — the slash command and the
 * Undo button — come through here, so the two cannot drift into behaving
 * differently about who is allowed to do what.
 *
 * The ordering is the design. Every guard runs before anything is posted, so
 * a cooldown, a spent allowance or a concurrent edit leaves NOTHING in the
 * church's channel; and the "working on it…" post happens inside
 * `onAccepted`, so a bot that has been kicked out of the channel fails before
 * the provider call rather than after it, and the church is not charged for
 * an edit whose result they were never going to see.
 */

export type SlackCommandContext = {
  teamId: string;
  slackUserId: string;
  channelId: string;
  /** Where an ephemeral reply goes. Validated as a Slack host at parse time. */
  responseUrl: string;
};

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The label a church would recognise, rather than a raw path. */
function pageLabel(path: string): string {
  return SITE_PAGE_LINKS.find((page) => page.href === path)?.label ?? path;
}

async function ephemeral(ctx: SlackCommandContext, message: SlackMessage): Promise<void> {
  const sent = await respondViaResponseUrl(ctx.responseUrl, message.text, message.blocks);
  if (!sent.ok) {
    console.error(`[slack] could not deliver an ephemeral reply (${sent.error})`);
  }
}

/**
 * Turns a Slack posting error into something a church can act on.
 *
 * `chat:write.public` means a public channel should never produce
 * `not_in_channel` — but a PRIVATE channel the app was removed from will, and
 * so will an archived one, so both get an answer rather than a raw error code.
 */
function describePostFailure(error: string): string {
  switch (error) {
    case "not_in_channel":
    case "channel_not_found":
      return "Regroup can't post in this channel any more. Invite it back, or reconnect Slack from your Regroup dashboard to pick a different channel.";
    case "is_archived":
      return "That channel is archived. Reconnect Slack from your Regroup dashboard to pick a different one.";
    case "invalid_auth":
    case "token_revoked":
    case "account_inactive":
      return "Regroup's access to this workspace has expired. Reconnect Slack from your Regroup dashboard.";
    default:
      return "Regroup couldn't post in this channel, so nothing was changed.";
  }
}

/** Where a church would go to see the result. */
async function siteLinks(siteId: string): Promise<{ editorUrl: string; publicUrl?: string }> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { slug: true, status: true },
  });

  const editorUrl = `${appUrl()}/dashboard/builder`;
  if (!site || site.status !== "PUBLISHED") return { editorUrl };

  // Reuses the domain layer's own rule: an ACTIVE primary custom domain wins,
  // otherwise the platform subdomain.
  const host = await canonicalHostForSite(siteId, site.slug);
  return { editorUrl, publicUrl: `https://${host}` };
}

/**
 * The one AI edit.
 *
 * Runs inside a Trigger.dev task, not the request, because the provider call
 * is far longer than Slack's three-second acknowledgement budget.
 */
export async function handlePrompt(
  ctx: SlackCommandContext,
  prompt: string
): Promise<void> {
  const auth = await authorizeSlackActor(ctx.teamId, ctx.slackUserId, ctx.channelId);
  if (!auth.ok) {
    // Re-checked here even though the route already checked: the task must
    // not trust its payload, and billing can lapse between the two.
    await ephemeral(ctx, failureMessage(auth.message));
    return;
  }

  const token = decryptToken(auth.connection.botAccessToken);

  /**
   * Captured from inside `onAccepted` so the result can edit the same message
   * rather than posting a second one. Stays undefined for every refusal that
   * happens before the announcement, which is every refusal that matters.
   */
  let messageTs: string | undefined;

  const outcome = await runEditorPromptJob({
    siteId: auth.siteId,
    userId: auth.userId,
    prompt,
    source: "slack",
    externalRef: { channelId: ctx.channelId, actorId: ctx.slackUserId },
    onAccepted: async () => {
      const working = workingMessage(prompt);
      const posted = await postMessage(token, ctx.channelId, working.text, working.blocks);

      // Fatal by design: throwing here fails the job BEFORE the provider is
      // called, so a church whose bot cannot speak is not billed for an edit
      // they would never have seen.
      if (!posted.ok) throw new Error(describePostFailure(posted.error));

      messageTs = posted.data.ts;
      return { externalMessageId: posted.data.ts };
    },
  });

  if (!outcome.ok) {
    const message = failureMessage(outcome.message);
    await ephemeral(ctx, message);

    // Only reachable when the failure came after the announcement, which
    // means the provider call. Leaving "working on it…" up forever would be
    // worse than replacing it with the reason.
    if (messageTs) {
      await updateMessage(token, ctx.channelId, messageTs, message.text, message.blocks);
    }
    return;
  }

  const { editorUrl, publicUrl } = await siteLinks(auth.siteId);
  const result = editResultMessage({
    summary: outcome.summary,
    path: outcome.path,
    pageLabel: pageLabel(outcome.path),
    improvementCount: outcome.improvements.length,
    editorUrl,
    publicUrl,
    // Nothing to undo when the model made no change to undo.
    undoJobId: outcome.applied ? outcome.jobId : undefined,
  });

  /**
   * The edit has COMMITTED by now, so the only question left is whether the
   * church hears about it. A `chat.update` can still fail — the message was
   * deleted, the bot was removed from a private channel in between — and
   * without a fallback the last thing they would ever see is "working on
   * it…", describing a change that actually landed.
   */
  const delivered = messageTs
    ? await updateMessage(token, ctx.channelId, messageTs, result.text, result.blocks)
    : // Belt and braces: `onAccepted` always runs on the success path, so this
      // is unreachable — but losing the church's result to a missing id would
      // be a poor way to find that out.
      await postMessage(token, ctx.channelId, result.text, result.blocks);

  if (!delivered.ok) {
    console.error(`[slack] could not deliver the edit result (${delivered.error})`);
    await ephemeral(ctx, result);
  }
}

/**
 * Undo, from either the `/regroup undo` command or the Undo button.
 *
 * One function for both, so the button and the command cannot come to
 * disagree about who may undo what. `sourceMessageTs`, when given, is the
 * result message the button was attached to: it gets rewritten so the Undo
 * button disappears, because a button that has already been used should not
 * still look clickable to the next person who scrolls past it.
 */
export async function handleUndo(
  ctx: SlackCommandContext,
  options: { jobId?: string; sourceMessageTs?: string } = {}
): Promise<void> {
  /**
   * Authorized as the person who CLICKED, not the person who ran the original
   * edit. A button sitting in a channel is clickable by everyone who can see
   * the channel, so its payload says nothing about who is pressing it.
   */
  const auth = await authorizeSlackActor(ctx.teamId, ctx.slackUserId, ctx.channelId);
  if (!auth.ok) {
    await ephemeral(ctx, failureMessage(auth.message));
    return;
  }

  const outcome = await revertPageEdit(auth.siteId, auth.userId, options.jobId);

  if (!outcome.ok) {
    await ephemeral(ctx, failureMessage(outcome.message));
    return;
  }

  const token = decryptToken(auth.connection.botAccessToken);
  const message = revertedMessage(pageLabel(outcome.path), outcome.alsoDiscarded);

  // Either way the revert has already happened, so the fallback matters as
  // much here as on the edit path: silence would read as "nothing occurred".
  const delivered = options.sourceMessageTs
    ? // Replaces the result message, which removes the Undo button with it.
      await updateMessage(
        token,
        ctx.channelId,
        options.sourceMessageTs,
        message.text,
        message.blocks
      )
    : await postMessage(token, ctx.channelId, message.text, message.blocks);

  if (!delivered.ok) {
    console.error(`[slack] could not deliver the undo result (${delivered.error})`);
    await ephemeral(ctx, message);
  }
}

/**
 * `help` and `status`, which answer inside the acknowledgement and never
 * reach a model. Returning the message rather than posting it is what lets
 * the route put it straight in the 200 body — no bot token needed, no
 * round-trip, and it still works if the task runner is down.
 */
export async function buildHelp(auth: SlackActorAuthorization): Promise<SlackMessage> {
  if (!auth.ok) return failureMessage(auth.message);
  return helpMessage(channelLabel(auth));
}

export async function buildStatus(auth: SlackActorAuthorization): Promise<SlackMessage> {
  if (!auth.ok) return failureMessage(auth.message);

  const [site, budget] = await Promise.all([
    prisma.site.findUnique({
      where: { id: auth.siteId },
      select: { slug: true, status: true },
    }),
    getAiBudget(auth.siteId, "editor_prompt"),
  ]);

  if (!site) return failureMessage("That Regroup site no longer exists.");

  const published = site.status === "PUBLISHED";
  const host = published ? await canonicalHostForSite(auth.siteId, site.slug) : null;

  return statusMessage({
    published,
    publicUrl: host ? `https://${host}` : undefined,
    editsRemaining: budget.remaining,
    editsLimit: budget.limit,
    resetsOn: budget.resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    channelName: channelLabel(auth),
  });
}

function channelLabel(auth: Extract<SlackActorAuthorization, { ok: true }>): string {
  const name = auth.connection.channelName;
  if (!name) return "this channel";
  return name.startsWith("#") ? name : `#${name}`;
}

export { authorizeSlackActor };
