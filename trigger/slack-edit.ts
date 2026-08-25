import { task } from "@trigger.dev/sdk";
import { handlePrompt, handleUndo, type SlackCommandContext } from "@/lib/slack/dispatch";
import { failureMessage } from "@/lib/slack/blocks";
import { respondViaResponseUrl } from "@/lib/slack/api";

/**
 * One `/regroup <prompt>`, as a durable run.
 *
 * Slack gives a slash command three seconds to acknowledge, and an LLM edit
 * takes far longer, so the route acks and hands the work here. Durability is
 * the reason this is a task rather than `after()`: a killed invocation would
 * leave the church with an acknowledgement and no result, AND a QUEUED job
 * row jamming their next edit — the timeout sweep that used to clean those up
 * was deliberately removed in favour of asking the task runner what really
 * happened.
 */
export type SlackEditPayload =
  | { action: "prompt"; context: SlackCommandContext; prompt: string }
  /**
   * `jobId` comes from the Undo button; `/regroup undo` omits it and means
   * "the most recent undoable edit". `sourceMessageTs` is the result message
   * the button sits on, rewritten on success so the button goes away.
   */
  | {
      action: "undo";
      context: SlackCommandContext;
      jobId?: string;
      sourceMessageTs?: string;
    };

export const slackEditTask = task({
  id: "slack-edit",

  /**
   * No automatic retry, for the same reason `full-build` opts out: the budget
   * counted this job the moment it was claimed, and the edit itself is not
   * idempotent — a silent second attempt would spend the church's money and
   * apply a second edit on top of the first. Re-running is one more slash
   * command, and it goes through the budget check again.
   */
  retry: { maxAttempts: 1 },

  // One provider call plus a handful of Slack round-trips. Generous enough for
  // a slow model, short enough that a hung run does not bill indefinitely.
  maxDuration: 120,

  run: async (payload: SlackEditPayload) => {
    if (payload.action === "undo") {
      await handleUndo(payload.context, {
        jobId: payload.jobId,
        sourceMessageTs: payload.sourceMessageTs,
      });
      return;
    }

    await handlePrompt(payload.context, payload.prompt);
  },

  /**
   * `handlePrompt` already reports every outcome it can see. This covers what
   * it cannot: the run dying underneath it. Without this the church is left
   * watching a "working on it…" message that will never change.
   *
   * The job row is closed out by `runEditorPromptJob`'s own error handling in
   * every case where the job was actually claimed, so this only has to speak.
   */
  onFailure: async ({ payload, error }) => {
    console.error("[slack-edit] run failed", error);

    const message = failureMessage(
      payload.action === "undo"
        ? "Something went wrong undoing that change. Open the editor to change it back."
        : "Something went wrong making that change, so nothing was updated. Try again in a moment."
    );

    await respondViaResponseUrl(payload.context.responseUrl, message.text, message.blocks).catch(
      (postError) => {
        console.error("[slack-edit] could not report the failure to Slack", postError);
      }
    );
  },
});
