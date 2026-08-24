import { prisma } from "@/lib/db";
import { hasBasePlan } from "@/lib/billing/entitlements";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";
import type { PageBlocks } from "@/lib/site/blocks/types";
import {
  claimJob,
  markJobFailed,
  markJobSucceeded,
  type JobView,
} from "./generation-job";
import { RateLimitError } from "@/lib/rate-limit";
import { AiBudgetExhaustedError, assertAiBudget } from "./usage";
import { runEditorPrompt } from "./editor-prompt-service";

/**
 * One AI edit, from claim to close-out.
 *
 * This is the body that used to live inside `ai.editorPrompt`. It moved out
 * when a SECOND caller appeared (Slack), and the move matters for one reason
 * beyond reuse: everything a tRPC procedure was doing for free — proving the
 * caller owns the site, proving they have a plan — has to keep happening for
 * a caller that arrives with no session at all. Doing those checks inside the
 * mutating function rather than around it is what keeps `CLAUDE.md`'s first
 * non-negotiable true no matter who calls.
 *
 * Deliberately free of any knowledge of Slack, HTTP or tRPC. The caller
 * translates the outcome into whatever its surface speaks: a `TRPCError`, a
 * Block Kit message. `externalRef` and `onAccepted` are the two seams that
 * let it stay that way.
 */

export type EditorPromptSource = "web" | "slack";

/** Where a non-web edit came from, recorded on the job for the audit trail. */
export type ExternalRef = {
  channelId: string;
  actorId: string;
};

export type EditorPromptFailureCode =
  | "NO_SITE"
  | "NO_PLAN"
  | "ALREADY_RUNNING"
  | "BUDGET_EXHAUSTED"
  | "COOLDOWN"
  | "POST_FAILED"
  | "PROVIDER_FAILED"
  /** Something broke that is nobody's fault and nobody's decision to make. */
  | "INTERNAL";

export type EditorPromptOutcome =
  | {
      ok: true;
      jobId: string;
      /**
       * The job row as it was CLAIMED.
       *
       * Returned rather than re-read, because re-reading is racy: the slot is
       * released the moment this job is marked succeeded, so a concurrent
       * edit can claim a new row before the caller looks, and "the latest
       * editor_prompt job" would then be somebody else's QUEUED one.
       */
      job: JobView;
      /** The page actually edited, which may differ from the one requested. */
      path: string;
      summary: string;
      applied: boolean;
      blocks: PageBlocks;
      improvements: SiteImprovement[];
      designFeedback: DesignFeedback[];
      mobileFeedback: DesignFeedback[];
    }
  | {
      ok: false;
      /** Present once a job row exists, so a caller can reference the attempt. */
      jobId?: string;
      code: EditorPromptFailureCode;
      /** Copy written for the person who asked. Safe to show verbatim. */
      message: string;
    };

export type RunEditorPromptJobArgs = {
  siteId: string;
  /** The Regroup user this edit is billed and authorized against. */
  userId: string;
  prompt: string;
  path?: string;
  source: EditorPromptSource;
  externalRef?: ExternalRef;
  /**
   * Awaited once the claim and the budget have cleared, and BEFORE the
   * provider call.
   *
   * This is the hook that lets a caller announce the edit — "working on it…"
   * in a Slack channel — without announcing edits that were never going to
   * happen. Every refusal above it is silent by construction.
   *
   * A throw is fatal and pre-spend: the job is failed and nothing is charged.
   * That is what makes "the bot was kicked out of the channel" fail before the
   * money is spent rather than after.
   */
  onAccepted?: (job: { id: string }) => Promise<{ externalMessageId?: string } | void>;
};

export async function runEditorPromptJob(
  args: RunEditorPromptJobArgs
): Promise<EditorPromptOutcome> {
  const { siteId, userId, prompt, path, source, externalRef, onAccepted } = args;

  /**
   * Ownership, re-asserted here rather than trusted from the caller.
   *
   * `paidSiteProcedure` already does this for the web path, and duplicating it
   * costs one indexed query. The alternative is that the day a caller without
   * a session shows up, the gate is wherever that caller remembered to put it.
   */
  const site = await prisma.site.findFirst({
    where: { id: siteId, userId },
    select: { id: true },
  });
  if (!site) {
    return { ok: false, code: "NO_SITE", message: "That site is not yours." };
  }

  if (!(await hasBasePlan(userId))) {
    return {
      ok: false,
      code: "NO_PLAN",
      message: "This needs an active plan.",
    };
  }

  /**
   * Claim the slot BEFORE charging.
   *
   * The database decides who wins, so two concurrent prompts produce one job
   * and one charge. Doing this after the budget check would charge the loser
   * for an edit it never got to start — and the monthly cap counts job rows,
   * so a second row is a second charge whether or not the provider was called.
   */
  const claim = await claimJob(siteId, "editor_prompt", prompt, {
    source,
    slackChannelId: externalRef?.channelId,
    slackUserId: externalRef?.actorId,
  });

  if (!claim.claimed) {
    return {
      ok: false,
      jobId: claim.job?.id,
      code: "ALREADY_RUNNING",
      message: "An AI edit is already running. Wait for it to finish.",
    };
  }

  const job = claim.job;

  try {
    await assertAiBudget(siteId, userId, "editor_prompt");
  } catch (error) {
    // Release the slot: a refused edit must not leave a QUEUED row jamming
    // every future attempt. The row stays as the audit trail.
    await markJobFailed(job.id, "This edit was not started.");

    /**
     * `assertAiBudget` does more than rate-limit — it counts job rows in
     * Postgres — so it can throw for reasons that are not a refusal at all.
     * Only a `RateLimitError` carries copy meant for a person; anything else
     * would put a raw database error into a field documented as safe to show
     * verbatim.
     */
    if (!(error instanceof RateLimitError)) {
      console.error("[editor-prompt] budget check failed", error);
      return {
        ok: false,
        jobId: job.id,
        code: "INTERNAL",
        message: "Something went wrong starting that edit. Try again in a moment.",
      };
    }

    return {
      ok: false,
      jobId: job.id,
      // Same refusal to the church, different sentence: a cooldown clears in
      // minutes, a spent allowance does not clear until next month.
      code: error instanceof AiBudgetExhaustedError ? "BUDGET_EXHAUSTED" : "COOLDOWN",
      message: error.message,
    };
  }

  if (onAccepted) {
    let accepted: { externalMessageId?: string } | void;

    try {
      accepted = await onAccepted({ id: job.id });
    } catch (error) {
      await markJobFailed(job.id, "Could not post to the channel, so nothing was changed.");
      return {
        ok: false,
        jobId: job.id,
        code: "POST_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Could not post to the channel, so nothing was changed.",
      };
    }

    /**
     * Outside the try above, and soft.
     *
     * The message HAS been posted by now, so a failure to write its id down
     * is not a failed post — reporting it as one would tell the church
     * "nothing was changed" while an orphaned "working on it…" sits in their
     * channel. Losing the id costs the in-place update, not the edit.
     */
    if (accepted?.externalMessageId) {
      try {
        await prisma.siteGenerationJob.update({
          where: { id: job.id },
          data: { slackMessageTs: accepted.externalMessageId },
        });
      } catch (error) {
        console.error("[editor-prompt] could not record the posted message id", error);
      }
    }
  }

  try {
    const result = await runEditorPrompt({
      siteId,
      prompt,
      path,
      jobId: job.id,
      // Charged again if the model retargets to another page, since that is a
      // second provider call.
      assertBudget: () =>
        assertAiBudget(siteId, userId, "editor_prompt").then(() => undefined),
    });

    /**
     * Closing the job out is bookkeeping AFTER the edit has committed, so its
     * failure must not be reported as a failed edit — the page has already
     * changed, and marking the row FAILED would both lie to the church and
     * hide the undo snapshot from any lookup that filters on status.
     *
     * An active row left behind does block the next edit from claiming the
     * slot, which is why this is logged loudly rather than ignored.
     */
    try {
      await markJobSucceeded(job.id, result.summary);
    } catch (error) {
      console.error(
        `[editor-prompt] job ${job.id} committed but could not be marked succeeded`,
        error
      );
    }

    return {
      ok: true,
      jobId: job.id,
      job,
      path: result.path,
      summary: result.summary,
      applied: result.applied,
      blocks: result.blocks,
      improvements: result.improvements,
      designFeedback: result.designFeedback,
      mobileFeedback: result.mobileFeedback,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI edit failed. Try again.";
    await markJobFailed(job.id, message.slice(0, 280));

    /**
     * A retarget's budget check happens INSIDE the run, so a second-call
     * refusal surfaces here rather than at the check above. It is still a
     * budget refusal to the caller, not a provider failure.
     */
    if (error instanceof RateLimitError) {
      return {
        ok: false,
        jobId: job.id,
        code: error instanceof AiBudgetExhaustedError ? "BUDGET_EXHAUSTED" : "COOLDOWN",
        message,
      };
    }

    return { ok: false, jobId: job.id, code: "PROVIDER_FAILED", message };
  }
}
