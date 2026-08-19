import { runs } from "@trigger.dev/sdk";
import { isActiveStatus, markJobFailed, type JobView } from "./generation-job";

/**
 * Reconciles a job row against the Trigger.dev run that is supposed to be
 * executing it.
 *
 * This exists because "the platform reports liveness" is only true for a run
 * that STARTS and then dies — `onFailure` marks the row terminal in that case.
 * A run that is never picked up at all is a different animal: nothing fails,
 * nothing throws, the row sits QUEUED forever, and because a site may only
 * have one active job, the church's Rebuild button is jammed permanently. That
 * happened for real when the app was pointed at the dev environment with no
 * worker connected.
 *
 * So the row is not trusted on its own. Before reporting an in-flight build,
 * we ask the platform what actually became of the run.
 */

/**
 * How long a run may sit un-started before we call it abandoned.
 *
 * Generous, because a legitimately queued run behind a busy worker is normal
 * and killing it would be worse than waiting. But bounded, because the failure
 * this catches is indistinguishable from waiting except by elapsed time.
 */
const QUEUE_STALL_MS = 3 * 60 * 1000;

/** Trigger.dev statuses that mean the run will never do any more work. */
const TERMINAL = new Set([
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "INTERRUPTED",
  "EXPIRED",
  "TIMED_OUT",
]);

const NO_WORKER_MESSAGE =
  "This build never started — no worker picked it up. " +
  "Check that a Trigger.dev worker is running for this environment, then try again.";

const VANISHED_MESSAGE =
  "This build could not be found on the task runner. Start a new one.";

function isNotFound(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : "";
  return status === 404 || /not found/i.test(message);
}

/**
 * Returns the job as it should actually be reported, failing the row when the
 * run behind it is provably not coming back.
 *
 * Never throws: a reconciliation that cannot reach Trigger.dev must not take
 * down the status endpoint the whole progress UI depends on. On any unexpected
 * error the row is returned untouched, which is the pre-existing behavior.
 */
export async function reconcileJobWithRun(job: JobView): Promise<JobView> {
  if (!isActiveStatus(job.status)) return job;

  // An active row with no run id never reached `tasks.trigger()` — there is
  // nothing to ask about, and nothing will ever move it.
  if (!job.triggerRunId) {
    await markJobFailed(job.id, VANISHED_MESSAGE);
    return { ...job, status: "FAILED", error: VANISHED_MESSAGE };
  }

  try {
    const run = await runs.retrieve(job.triggerRunId);

    // The task itself owns SUCCEEDED (it writes the site in the same
    // transaction), so a COMPLETED run whose row is still active means the
    // commit is moments away — leave it alone rather than racing it.
    if (run.status === "COMPLETED") return job;

    if (TERMINAL.has(run.status)) {
      const message = describeTerminalRun(run.status);
      await markJobFailed(job.id, message);
      return { ...job, status: "FAILED", error: message };
    }

    // Still queued long past the point where a healthy worker would have
    // taken it. Cancel first so a worker connecting later cannot resurrect a
    // build the church has already been told is dead.
    const queuedFor = Date.now() - new Date(job.createdAt).getTime();
    if (!run.startedAt && queuedFor > QUEUE_STALL_MS) {
      await runs.cancel(job.triggerRunId).catch((error) => {
        console.error(`[reconcile] could not cancel ${job.triggerRunId}`, error);
      });
      await markJobFailed(job.id, NO_WORKER_MESSAGE);
      return { ...job, status: "FAILED", error: NO_WORKER_MESSAGE };
    }

    return job;
  } catch (error) {
    if (isNotFound(error)) {
      await markJobFailed(job.id, VANISHED_MESSAGE);
      return { ...job, status: "FAILED", error: VANISHED_MESSAGE };
    }
    console.error(`[reconcile] could not read run ${job.triggerRunId}`, error);
    return job;
  }
}

function describeTerminalRun(status: string): string {
  if (status === "CANCELED") return "This build was canceled.";
  if (status === "EXPIRED" || status === "TIMED_OUT") {
    return "This build took too long and was stopped. Try again.";
  }
  return "The build stopped unexpectedly. Try again.";
}
