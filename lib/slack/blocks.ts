import type { SlackBlock } from "./api";

/**
 * What Regroup says in Slack.
 *
 * Pure builders — data in, Block Kit out — so the copy can be tested without
 * a workspace. Every function returns `{ text, blocks }` because `text` is
 * not decoration: it is what Slack puts in the notification and in clients
 * that cannot render blocks, so a message without it arrives blank.
 *
 * One rule the tests enforce: a failure block says what went wrong and what
 * to do about it, and nothing else. No church name, no site URL, no bound
 * account — a refusal is often read by people who are not the church admin,
 * and there is no reason for it to describe someone else's setup.
 */

export type SlackMessage = { text: string; blocks: SlackBlock[] };

/** The action id the interactivity route dispatches on. */
export const UNDO_ACTION_ID = "regroup_undo";

function section(markdown: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text: markdown } };
}

function context(markdown: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text: markdown }] };
}

function linkButton(text: string, url: string): SlackBlock {
  return { type: "button", text: { type: "plain_text", text }, url };
}

/**
 * Slack renders `*bold*` and `_italic_`, so text interpolated into mrkdwn
 * has to be defanged — a church whose name contains an asterisk should not
 * reformat the message around it.
 */
function plain(value: string): string {
  return value.replace(/[*_~`>]/g, "");
}

/** Posted as soon as an edit is accepted, then edited in place with the result. */
export function workingMessage(prompt: string): SlackMessage {
  const text = "Regroup is updating your site…";
  return {
    text,
    blocks: [section(`:hourglass_flowing_sand: *${text}*`), context(`_${plain(prompt)}_`)],
  };
}

export type EditResultInput = {
  summary: string;
  /** The page actually changed, which may not be the one the church expected. */
  pageLabel: string;
  path: string;
  improvementCount: number;
  editorUrl: string;
  /** Only when the site is published — a draft has nothing to look at yet. */
  publicUrl?: string;
  /** Absent once the edit is no longer the most recent, or already undone. */
  undoJobId?: string;
};

export function editResultMessage(input: EditResultInput): SlackMessage {
  const text = input.summary;
  const blocks: SlackBlock[] = [
    section(`:white_check_mark: ${plain(input.summary)}`),
    // Named explicitly because the model may retarget: a church asking about
    // "the heading" while thinking of the homepage can get /about changed.
    context(`Changed *${plain(input.pageLabel)}* (\`${plain(input.path)}\`)`),
  ];

  if (input.improvementCount > 0) {
    blocks.push(
      context(
        `${input.improvementCount} suggestion${input.improvementCount === 1 ? "" : "s"} waiting in the editor`
      )
    );
  }

  const actions: SlackBlock[] = [linkButton("Open editor", input.editorUrl)];
  if (input.publicUrl) actions.push(linkButton("View site", input.publicUrl));
  if (input.undoJobId) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Undo" },
      style: "danger",
      action_id: UNDO_ACTION_ID,
      value: input.undoJobId,
      confirm: {
        title: { type: "plain_text", text: "Undo this edit?" },
        text: {
          type: "mrkdwn",
          text: "This puts the page back exactly as it was before this edit. Anything saved in the editor since will be discarded.",
        },
        confirm: { type: "plain_text", text: "Undo" },
        deny: { type: "plain_text", text: "Keep it" },
      },
    });
  }

  blocks.push({ type: "actions", elements: actions });
  return { text, blocks };
}

/**
 * Every refusal and every failure.
 *
 * Deliberately bare. This is the message a workspace member sees when they
 * were not allowed to do something, and it must not describe the church's
 * setup to them.
 */
export function failureMessage(message: string): SlackMessage {
  return {
    text: message,
    blocks: [section(`:warning: ${plain(message)}`)],
  };
}

export type StatusInput = {
  published: boolean;
  publicUrl?: string;
  editsRemaining: number;
  editsLimit: number;
  resetsOn: string;
  channelName: string;
};

export function statusMessage(input: StatusInput): SlackMessage {
  const state = input.published ? "Published" : "Draft — not visible to visitors yet";
  const text = `Your site is ${input.published ? "published" : "a draft"}.`;

  const blocks: SlackBlock[] = [
    section(`*Site:* ${plain(state)}`),
    section(
      `*AI edits:* ${input.editsRemaining} of ${input.editsLimit} left this month, resets ${plain(input.resetsOn)}`
    ),
    context(`Regroup answers in ${plain(input.channelName)}`),
  ];

  if (input.publicUrl) blocks.push({ type: "actions", elements: [linkButton("View site", input.publicUrl)] });

  return { text, blocks };
}

export function helpMessage(channelName: string): SlackMessage {
  const text = "How to use /regroup";
  return {
    text,
    blocks: [
      section(
        [
          "*`/regroup <what to change>`* — edit your website with AI.",
          "*`/regroup status`* — is the site live, and how many edits are left.",
          "*`/regroup undo`* — put the last edit back.",
          "*`/regroup help`* — this message.",
        ].join("\n")
      ),
      context(
        [
          `Regroup only answers in ${plain(channelName)}, and only for the account that connected this workspace.`,
          "Undo reaches back one edit, expires 15 minutes after it finishes, and does not refund the edit.",
        ].join("\n")
      ),
    ],
  };
}

export function revertedMessage(pageLabel: string, alsoDiscarded: boolean): SlackMessage {
  const text = `Reverted the change to ${pageLabel}.`;
  const blocks: SlackBlock[] = [section(`:leftwards_arrow_with_hook: ${plain(text)}`)];

  if (alsoDiscarded) {
    // The page had changed again since this edit, so undo threw more away
    // than the church may expect. Saying so is the whole point.
    blocks.push(
      context("This also discarded changes saved in the editor after that edit.")
    );
  }

  return { text, blocks };
}
