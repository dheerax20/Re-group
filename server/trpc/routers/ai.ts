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
  markJobSucceeded,
  type JobView,
} from "@/lib/ai/generation-job";
import { reconcileJobWithRun } from "@/lib/ai/reconcile-run";
import type { fullBuildTask } from "@/trigger/full-build";
import { assertAiBudget, getAiBudget } from "@/lib/ai/usage";
import { runEditorPrompt } from "@/lib/ai/editor-prompt-service";
import {
  getChatBudget,
  getChatHistory,
  sendChatMessage,
} from "@/lib/chat/service";

const siteInput = z.object({ siteId: z.string().min(1) });

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
    .input(siteInput.extend({ prompt: z.string().trim().min(4).max(600) }))
    .mutation(async ({ ctx, input }) => {
      // Claim the slot first, for the same reason the build does: the ledger
      // row is written whether or not the call succeeds (the provider was
      // still going to be called, and the monthly cap counts rows), so two
      // concurrent prompts must not produce two rows and two charges.
      const claim = await claimJob(input.siteId, "editor_prompt", input.prompt);
      if (!claim.claimed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An AI edit is already running. Wait for it to finish.",
        });
      }
      const job = claim.job;

      try {
        await assertAiBudget(input.siteId, ctx.user.id, "editor_prompt");
      } catch (error) {
        await markJobFailed(job.id, "This edit was not started.");
        throw error;
      }

      try {
        const result = await runEditorPrompt(input.siteId, input.prompt);
        // Inline jobs must be closed out explicitly — an active row would
        // block the next edit from claiming the slot.
        await markJobSucceeded(job.id, result.summary);
        return { job, result };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The AI edit failed. Try again.";
        await markJobFailed(job.id, message.slice(0, 280));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
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
    .input(siteInput.extend({ content: z.string().trim().min(2).max(1000) }))
    .mutation(async ({ ctx, input }) =>
      sendChatMessage(input.siteId, ctx.user.id, input.content)
    ),
});
