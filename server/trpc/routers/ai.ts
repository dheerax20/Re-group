import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auth, tasks } from "@trigger.dev/sdk";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import {
  attachRunId,
  claimJob,
  findActiveJob,
  getLatestJob,
  markJobFailed,
  type JobView,
} from "@/lib/ai/generation-job";
import { reconcileJobWithRun } from "@/lib/ai/reconcile-run";
import { MAX_PROMPT_CHARS, MIN_PROMPT_CHARS } from "@/lib/ai/prompt-limits";
import type { fullBuildTask } from "@/trigger/full-build";
import { assertAiBudget, getAiBudget } from "@/lib/ai/usage";
import {
  runEditorPromptJob,
  type EditorPromptFailureCode,
} from "@/lib/ai/editor-prompt-run";
import {
  getChatBudget,
  getChatHistory,
  sendChatMessage,
} from "@/lib/chat/service";

const siteInput = z.object({ siteId: z.string().min(1) });

/**
 * How an edit refusal reaches the browser.
 *
 * `TOO_MANY_REQUESTS` for both budget refusals is what the error-translation
 * middleware already produced when `assertAiBudget`'s `RateLimitError`
 * propagated, and the editor's copy depends on it — so the extraction
 * preserves it rather than picking a tidier code. `POST_FAILED` cannot occur
 * on this path (nothing passes `onAccepted`) but is mapped for totality.
 */
const TRPC_CODE_FOR: Record<EditorPromptFailureCode, TRPCError["code"]> = {
  NO_SITE: "FORBIDDEN",
  NO_PLAN: "PAYMENT_REQUIRED",
  ALREADY_RUNNING: "CONFLICT",
  BUDGET_EXHAUSTED: "TOO_MANY_REQUESTS",
  COOLDOWN: "TOO_MANY_REQUESTS",
  POST_FAILED: "INTERNAL_SERVER_ERROR",
  PROVIDER_FAILED: "INTERNAL_SERVER_ERROR",
  INTERNAL: "INTERNAL_SERVER_ERROR",
};

/**
 * A read token scoped to one run, so the browser can subscribe to it.
 *
 * Scoped deliberately narrowly: this token goes to the client, and a broader
 * one would let any church's browser read any other church's runs.
 */
async function runToken(runId: string): Promise<string> {
  return auth.createPublicToken({
    scopes: { read: { runs: [runId] } },
    expirationTime: "1h",
  });
}

export const aiRouter = router({
  /**
   * Queues a build and returns immediately with everything the client needs to
   * watch it live.
   *
   * The budget check runs before anything is queued — the point is to not make
   * the call. An already-active job is returned rather than starting a second
   * one, so a double-click or a refresh costs nothing, and `idempotencyKey`
   * closes the remaining window where two triggers could race.
   */
  startBuild: paidSiteProcedure
    .input(siteInput)
    .mutation(async ({ ctx, input }) => {
      // Reconcile first. An active row whose run is dead would otherwise send
      // the church straight back to a build that is never going to finish.
      const existing = await getLatestJob(input.siteId, "full_build");
      if (existing) await reconcileJobWithRun(existing);

      const active = await findActiveJob(input.siteId, "full_build");
      if (active?.triggerRunId) {
        return {
          runId: active.triggerRunId,
          publicAccessToken: await runToken(active.triggerRunId),
          job: await getLatestJob(input.siteId, "full_build"),
        };
      }

      /**
       * Claim the slot BEFORE charging. The database decides who wins, so two
       * concurrent clicks produce one job and one charge; the loser gets the
       * winner's run to watch. Doing this after `assertAiBudget` would charge
       * the loser for a build it never got to start.
       */
      const claim = await claimJob(input.siteId, "full_build");
      if (!claim.claimed) {
        const job = claim.job;
        return {
          runId: job?.triggerRunId ?? null,
          publicAccessToken: job?.triggerRunId ? await runToken(job.triggerRunId) : null,
          job,
        };
      }

      const job = claim.job;

      try {
        await assertAiBudget(input.siteId, ctx.user.id, "full_build");
      } catch (error) {
        // Release the slot: a refused build must not leave a QUEUED row
        // jamming every future attempt. The row stays as the audit trail.
        await markJobFailed(job.id, "This build was not started.");
        throw error;
      }

      let handle;
      try {
        handle = await tasks.trigger<typeof fullBuildTask>(
          "full-build",
          { siteId: input.siteId, jobId: job.id },
          { idempotencyKey: `build-${job.id}` }
        );
      } catch (error) {
        // Same reasoning: if the run could not be enqueued at all, the row
        // must not stay active or nothing will ever start again.
        await markJobFailed(
          job.id,
          "Could not reach the task runner. Check TRIGGER_SECRET_KEY, then try again."
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not start the build. Try again in a moment.",
          cause: error,
        });
      }

      await attachRunId(job.id, handle.id);

      return {
        runId: handle.id,
        publicAccessToken: handle.publicAccessToken,
        job: { ...job, triggerRunId: handle.id } satisfies JobView,
      };
    }),

  /**
   * The resume path, not a poll loop.
   *
   * A client that reloads mid-build calls this once to recover the run id and
   * a fresh token, then re-subscribes. It is also the fallback that renders a
   * terminal state when there is no live run left to subscribe to.
   */
  buildStatus: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => {
      const latest = await getLatestJob(input.siteId, "full_build");
      if (!latest) return null;

      // The row alone cannot tell a slow build from an abandoned one; this
      // asks the task runner and fails the row when the run is provably gone.
      const job = await reconcileJobWithRun(latest);

      const live = job.status === "QUEUED" || job.status === "RUNNING";
      const publicAccessToken =
        live && job.triggerRunId ? await runToken(job.triggerRunId) : null;

      return { job, publicAccessToken };
    }),

  budget: ownedSiteProcedure
    .input(siteInput.extend({ kind: z.enum(["full_build", "editor_prompt", "chat_message"]) }))
    .query(async ({ input }) => getAiBudget(input.siteId, input.kind)),

  /**
   * The one-shot editor prompt. Runs inline: it is a single LLM call, well
   * under the request timeout, and handing it to a durable run would only add
   * latency to something the church is watching happen.
   */
  editorPrompt: paidSiteProcedure
    .input(
      siteInput.extend({
        prompt: z.string().trim().min(MIN_PROMPT_CHARS).max(MAX_PROMPT_CHARS),
        /** Which page to edit. Validated against the site's editable pages. */
        path: z.string().trim().max(60).default("/"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      /**
       * The claim, the budget and the job bookkeeping all live in
       * `runEditorPromptJob` now, shared with the Slack command surface. This
       * procedure's remaining job is to translate one outcome into the tRPC
       * vocabulary the editor already handles — the codes below are exactly
       * the ones this mutation threw before the extraction.
       */
      const outcome = await runEditorPromptJob({
        siteId: input.siteId,
        userId: ctx.user.id,
        prompt: input.prompt,
        path: input.path,
        source: "web",
      });

      if (!outcome.ok) {
        throw new TRPCError({
          code: TRPC_CODE_FOR[outcome.code],
          message: outcome.message,
        });
      }

      /**
       * The job the run CLAIMED, not the latest one on the site. Re-reading
       * would be racy — the slot is released as soon as this job succeeds, so
       * a concurrent edit can claim a newer row in between — and it would make
       * a field that was always present suddenly nullable.
       */
      return {
        job: outcome.job,
        result: {
          summary: outcome.summary,
          path: outcome.path,
          blocks: outcome.blocks,
          applied: outcome.applied,
          improvements: outcome.improvements,
          designFeedback: outcome.designFeedback,
          mobileFeedback: outcome.mobileFeedback,
        },
      };
    }),

  chatHistory: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => getChatHistory(input.siteId)),

  chatBudget: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => getChatBudget(input.siteId)),

  /**
   * One chat turn. Also inline — the LangGraph classifier plus at most one
   * generation call, and the church is waiting on the reply.
   */
  chatSend: paidSiteProcedure
    .input(
      siteInput.extend({
        content: z.string().trim().min(2).max(1000),
        path: z.string().trim().max(60).default("/"),
      })
    )
    .mutation(async ({ ctx, input }) =>
      sendChatMessage(input.siteId, ctx.user.id, input.content, input.path)
    ),
});
