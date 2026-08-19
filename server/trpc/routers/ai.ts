import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auth, tasks } from "@trigger.dev/sdk";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import {
  attachRunId,
  createJob,
  findActiveJob,
  getLatestJob,
  type JobView,
} from "@/lib/ai/generation-job";
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
      const active = await findActiveJob(input.siteId, "full_build");
      if (active?.triggerRunId) {
        return {
          runId: active.triggerRunId,
          publicAccessToken: await runToken(active.triggerRunId),
          job: await getLatestJob(input.siteId, "full_build"),
        };
      }

      await assertAiBudget(input.siteId, ctx.user.id, "full_build");

      const job = await createJob(input.siteId, "full_build");

      const handle = await tasks.trigger<typeof fullBuildTask>(
        "full-build",
        { siteId: input.siteId, jobId: job.id },
        { idempotencyKey: `build-${job.id}` }
      );

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
      const job = await getLatestJob(input.siteId, "full_build");
      if (!job) return null;

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
      await assertAiBudget(input.siteId, ctx.user.id, "editor_prompt");

      // The ledger row is written whether or not the call succeeds — the
      // provider was still going to be called, and the monthly cap counts rows.
      const job = await createJob(input.siteId, "editor_prompt", input.prompt);

      try {
        const result = await runEditorPrompt(input.siteId, input.prompt);
        return { job, result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "The AI edit failed. Try again.",
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
