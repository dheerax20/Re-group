import { task, metadata } from "@trigger.dev/sdk";
import {
  commitBuild,
  describeBuildFailure,
  markJobFailed,
  markJobRunning,
  runCrewBuild,
  writeJobProgress,
} from "@/lib/ai/generation-job";

/**
 * The six-agent website crew, as a durable run.
 *
 * This replaces `after(() => runFullBuildJob(id))`. The move buys two things
 * the request-scoped version could not have. First, liveness: a run that dies
 * is reported as failed by the platform, so the five-minute `STALE_JOB_MS`
 * guess about dead runners is gone. Second, real-time progress — the client
 * subscribes to this run rather than polling a row on a timer.
 *
 * The crew itself is untouched. `runCrewBuild` is the old `runFullBuildJob`
 * body with the commit split off; art direction picking, the concurrent media
 * director, the OpenAI structured-output handling, and the per-call LangChain
 * timeout/retry config all still live in `lib/ai`.
 */
export type FullBuildPayload = {
  siteId: string;
  jobId: string;
};

export const fullBuildTask = task({
  id: "full-build",
  // The crew is routinely over a minute; this leaves headroom for a slow
  // provider without letting a hung run bill indefinitely.
  maxDuration: 600,
  /**
   * Deliberately no automatic retry. Each attempt is six LLM calls, and the
   * budget already counted this job when it was queued — a silent retry would
   * spend real money the church did not ask to spend. Rebuilding is one click
   * and goes through the budget check again.
   */
  retry: { maxAttempts: 1 },
  run: async ({ siteId, jobId }: FullBuildPayload) => {
    await markJobRunning(jobId);

    const { built } = await runCrewBuild(siteId, async (step, stepIndex) => {
      // Metadata is what the client's subscription reads; the job row is the
      // durable copy a reloaded client resumes from.
      metadata.set("step", step);
      metadata.set("stepIndex", stepIndex);

      // A progress write must never fail a build that is otherwise fine.
      await writeJobProgress(jobId, step, stepIndex).catch((error) => {
        console.error(`[full-build] progress write failed at "${step}"`, error);
      });
    });

    await commitBuild(siteId, jobId, built);

    return { siteId, styleName: built.styleName };
  },
  onFailure: async ({ payload, error }) => {
    await markJobFailed(payload.jobId, describeBuildFailure(error));
  },
});
