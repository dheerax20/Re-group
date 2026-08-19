import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobView } from "@/lib/ai/generation-job";

/**
 * The reconciler exists because a Trigger.dev run that is never PICKED UP
 * fails nothing: `onFailure` only fires for a run that starts and dies. The
 * row stays QUEUED, and since a site may hold only one active job, Rebuild
 * jams permanently. That happened in practice, so these cases are regression
 * tests rather than hypotheticals.
 */
const retrieve = vi.fn();
const cancel = vi.fn().mockResolvedValue(undefined);
const markJobFailed = vi.fn().mockResolvedValue(undefined);

vi.mock("@trigger.dev/sdk", () => ({
  runs: {
    retrieve: (...args: unknown[]) => retrieve(...args),
    cancel: (...args: unknown[]) => cancel(...args),
  },
}));

vi.mock("@/lib/ai/generation-job", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/generation-job")>(
    "@/lib/ai/generation-job"
  );
  return {
    isActiveStatus: actual.isActiveStatus,
    markJobFailed: (...args: unknown[]) => markJobFailed(...args),
  };
});

const { reconcileJobWithRun } = await import("@/lib/ai/reconcile-run");

function job(overrides: Partial<JobView> = {}): JobView {
  return {
    id: "job1",
    status: "QUEUED",
    step: null,
    stepIndex: 0,
    totalSteps: 6,
    error: null,
    styleName: null,
    summary: null,
    triggerRunId: "run_abc",
    createdAt: new Date().toISOString(),
    finishedAt: null,
    ...overrides,
  };
}

/** Older than QUEUE_STALL_MS (3 minutes) in the reconciler. */
const longAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

beforeEach(() => {
  retrieve.mockReset();
  cancel.mockClear();
  markJobFailed.mockClear();
});

describe("reconcileJobWithRun", () => {
  it("leaves a terminal job alone without calling the platform", async () => {
    const done = job({ status: "SUCCEEDED" });
    expect(await reconcileJobWithRun(done)).toBe(done);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("fails an active job that never got a run id", async () => {
    const result = await reconcileJobWithRun(job({ triggerRunId: null }));
    expect(result.status).toBe("FAILED");
    expect(markJobFailed).toHaveBeenCalledWith("job1", expect.stringContaining("could not be found"));
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("fails a job whose run crashed", async () => {
    retrieve.mockResolvedValue({ status: "CRASHED", startedAt: new Date() });
    const result = await reconcileJobWithRun(job({ status: "RUNNING" }));
    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/stopped unexpectedly/i);
  });

  it("reports a canceled run in its own words", async () => {
    retrieve.mockResolvedValue({ status: "CANCELED", startedAt: new Date() });
    const result = await reconcileJobWithRun(job({ status: "RUNNING" }));
    expect(result.error).toMatch(/canceled/i);
  });

  it("does NOT fail a COMPLETED run whose commit has not landed yet", async () => {
    // The task writes the site and the job in one transaction, so a COMPLETED
    // run with an active row means the commit is moments away. Failing it here
    // would race a build that actually succeeded.
    retrieve.mockResolvedValue({ status: "COMPLETED", startedAt: new Date() });
    const input = job({ status: "RUNNING" });
    expect(await reconcileJobWithRun(input)).toBe(input);
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  it("leaves a recently queued run alone", async () => {
    retrieve.mockResolvedValue({ status: "QUEUED", startedAt: null });
    const input = job();
    expect(await reconcileJobWithRun(input)).toBe(input);
    expect(markJobFailed).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels and fails a run left queued past the stall window", async () => {
    // The exact production failure: app pointed at an environment with no
    // worker connected, so the run sat queued forever.
    retrieve.mockResolvedValue({ status: "QUEUED", startedAt: null });
    const result = await reconcileJobWithRun(job({ createdAt: longAgo }));
    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/no worker picked it up/i);
    // Cancelled so a worker connecting later cannot resurrect it.
    expect(cancel).toHaveBeenCalledWith("run_abc");
  });

  it("does not stall a run that started but is simply slow", async () => {
    retrieve.mockResolvedValue({ status: "EXECUTING", startedAt: new Date() });
    const input = job({ status: "RUNNING", createdAt: longAgo });
    expect(await reconcileJobWithRun(input)).toBe(input);
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  it("fails a job whose run no longer exists", async () => {
    retrieve.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    const result = await reconcileJobWithRun(job());
    expect(result.status).toBe("FAILED");
  });

  it("returns the row untouched when the platform is unreachable", async () => {
    // A reconciliation outage must not take down the status endpoint the whole
    // progress UI depends on, and must not invent a failure.
    retrieve.mockRejectedValue(new Error("ECONNRESET"));
    const input = job();
    expect(await reconcileJobWithRun(input)).toBe(input);
    expect(markJobFailed).not.toHaveBeenCalled();
  });
});
