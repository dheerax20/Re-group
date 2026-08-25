import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitError } from "@/lib/rate-limit";

/**
 * The shared edit run.
 *
 * This function used to be the body of a tRPC mutation, where ownership, the
 * plan check and the session all came for free from the procedure builder.
 * Slack calls it with no session at all, so those guarantees now have to hold
 * INSIDE it — and the ordering has to hold too, because each step spends
 * something the previous one hasn't committed yet:
 *
 *   own the site → have a plan → claim the slot → clear the budget →
 *   announce it → call the provider
 *
 * Every test below pins one edge of that sequence. The ones that matter most
 * are the negative assertions: that nothing is claimed before ownership is
 * proven, that no provider call happens after a refusal, and that a failed
 * announcement kills the edit BEFORE the money is spent rather than after.
 */
const site = { findFirst: vi.fn() };
const siteGenerationJob = { update: vi.fn().mockResolvedValue({}) };

vi.mock("@/lib/db", () => ({
  prisma: { site, siteGenerationJob },
  withDbRetry: (fn: () => unknown) => fn(),
}));

const hasBasePlan = vi.fn();
vi.mock("@/lib/billing/entitlements", () => ({
  hasBasePlan: () => hasBasePlan(),
}));

const claimJob = vi.fn();
const markJobFailed = vi.fn().mockResolvedValue(undefined);
const markJobSucceeded = vi.fn().mockResolvedValue(undefined);
const isActiveStatus = vi.fn();
vi.mock("@/lib/ai/generation-job", () => ({
  claimJob: (...args: [string, string, string?, unknown?]) => claimJob(...args),
  markJobFailed: (...args: [string, string]) => markJobFailed(...args),
  markJobSucceeded: (...args: [string, string]) => markJobSucceeded(...args),
  isActiveStatus: (status: string) => isActiveStatus(status),
}));

/**
 * Mocked rather than imported: the real module talks to the Trigger.dev SDK,
 * and this file is about the ORDER of the guards, not about run liveness.
 */
const reconcileJobWithRun = vi.fn();
vi.mock("@/lib/ai/reconcile-run", () => ({
  reconcileJobWithRun: (job: unknown) => reconcileJobWithRun(job),
}));

const assertAiBudget = vi.fn();
vi.mock("@/lib/ai/usage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/usage")>("@/lib/ai/usage");
  return {
    AiBudgetExhaustedError: actual.AiBudgetExhaustedError,
    assertAiBudget: () => assertAiBudget(),
  };
});

const runEditorPrompt = vi.fn();
vi.mock("@/lib/ai/editor-prompt-service", () => ({
  runEditorPrompt: (args: unknown) => runEditorPrompt(args),
}));

const { AiBudgetExhaustedError } = await import("@/lib/ai/usage");
const { runEditorPromptJob } = await import("@/lib/ai/editor-prompt-run");

const OWNED = { siteId: "site-1", userId: "user-1", prompt: "warm up the hero" };

function succeedingEdit() {
  runEditorPrompt.mockResolvedValue({
    summary: "Warmed the hero.",
    path: "/",
    blocks: [],
    applied: true,
    improvements: [],
    designFeedback: [],
    mobileFeedback: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  site.findFirst.mockResolvedValue({ id: "site-1" });
  hasBasePlan.mockResolvedValue(true);
  claimJob.mockResolvedValue({ claimed: true, job: { id: "job-1" } });
  // Default: whatever holds the slot is genuinely alive, so a lost claim stands.
  reconcileJobWithRun.mockImplementation(async (job: { status?: string }) => job);
  isActiveStatus.mockReturnValue(true);
  assertAiBudget.mockResolvedValue({ remaining: 10 });
  siteGenerationJob.update.mockResolvedValue({});
  succeedingEdit();
});

describe("runEditorPromptJob", () => {
  it("runs the edit and closes the job out when everything clears", async () => {
    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({
      ok: true,
      jobId: "job-1",
      path: "/",
      applied: true,
      summary: "Warmed the hero.",
    });
    // An active row would block the next edit from claiming the slot.
    expect(markJobSucceeded).toHaveBeenCalledWith("job-1", "Warmed the hero.");
  });

  it("returns the job it claimed rather than whatever is latest", async () => {
    // Re-reading "the latest editor_prompt job" is racy: the slot is released
    // the moment this one succeeds, so a concurrent edit can claim a newer row
    // before the caller looks.
    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.job).toEqual({ id: "job-1" });
  });

  it("carries the design and mobile feedback through", async () => {
    runEditorPrompt.mockResolvedValue({
      summary: "Done.",
      path: "/",
      blocks: [],
      applied: true,
      improvements: [{ title: "i", detail: "d", action: "a" }],
      designFeedback: [{ title: "d", detail: "d", area: "hero" }],
      mobileFeedback: [{ title: "m", detail: "d", area: "nav" }],
    });

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({
      ok: true,
      designFeedback: [{ area: "hero" }],
      mobileFeedback: [{ area: "nav" }],
    });
  });

  it("does not dress a database failure up as a rate limit", async () => {
    // `assertAiBudget` also COUNTS rows in Postgres, so it throws for reasons
    // that are not refusals. Reporting those as a cooldown would put raw
    // driver text into a field documented as safe to show a person.
    assertAiBudget.mockRejectedValue(
      new Error('Invalid `prisma.siteGenerationJob.count()` invocation: connection refused')
    );

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack" });

    expect(outcome).toMatchObject({ ok: false, code: "INTERNAL" });
    if (!outcome.ok) {
      expect(outcome.message).not.toContain("prisma");
      expect(outcome.message).not.toContain("connection refused");
    }
  });

  it("keeps the edit when only recording the message id fails", async () => {
    // The message really was posted. Calling that a failed post would tell the
    // church nothing changed while an orphaned "working on it…" sits in their
    // channel.
    siteGenerationJob.update.mockRejectedValue(new Error("connection reset"));
    const onAccepted = vi.fn().mockResolvedValue({ externalMessageId: "1700000000.000100" });

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack", onAccepted });

    expect(outcome).toMatchObject({ ok: true });
    expect(runEditorPrompt).toHaveBeenCalled();
  });

  it("does not report a committed edit as failed when only the close-out fails", async () => {
    // The page has already changed, and marking the row FAILED would both lie
    // to the church and hide the undo snapshot from a status-filtered lookup.
    markJobSucceeded.mockRejectedValue(new Error("connection reset"));

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({ ok: true, applied: true });
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  it("passes the job id down so the snapshot lands in the write's transaction", async () => {
    await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(runEditorPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-1", jobId: "job-1" })
    );
  });

  it("refuses a site the user does not own, before claiming anything", async () => {
    // The query is scoped by userId, so a foreign site simply is not found.
    site.findFirst.mockResolvedValue(null);

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack" });

    expect(outcome).toMatchObject({ ok: false, code: "NO_SITE" });
    expect(claimJob).not.toHaveBeenCalled();
    expect(assertAiBudget).not.toHaveBeenCalled();
    expect(runEditorPrompt).not.toHaveBeenCalled();
  });

  it("refuses a caller with no active plan", async () => {
    hasBasePlan.mockResolvedValue(false);

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack" });

    expect(outcome).toMatchObject({ ok: false, code: "NO_PLAN" });
    expect(claimJob).not.toHaveBeenCalled();
  });

  it("refuses a second concurrent edit without charging for it", async () => {
    claimJob.mockResolvedValue({ claimed: false, job: { id: "job-running" } });

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({
      ok: false,
      code: "ALREADY_RUNNING",
      jobId: "job-running",
    });
    // The loser of the race must not be billed for an edit it never started.
    expect(assertAiBudget).not.toHaveBeenCalled();
    expect(runEditorPrompt).not.toHaveBeenCalled();
  });

  it("reclaims the slot when the job holding it belongs to a dead run", async () => {
    /**
     * The failure this prevents: a run killed between claiming its row and its
     * own error handling leaves that row QUEUED forever. Only one active job
     * per site may exist, so without this ONE dead run disables editing for
     * that church permanently — from Slack and from the web editor both.
     */
    const dead = { id: "job-dead", status: "QUEUED", triggerRunId: "run_dead" };
    claimJob
      .mockResolvedValueOnce({ claimed: false, job: dead })
      .mockResolvedValueOnce({ claimed: true, job: { id: "job-2" } });
    reconcileJobWithRun.mockResolvedValue({ ...dead, status: "FAILED" });
    isActiveStatus.mockReturnValue(false);

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack" });

    expect(reconcileJobWithRun).toHaveBeenCalledWith(dead);
    expect(claimJob).toHaveBeenCalledTimes(2);
    expect(outcome).toMatchObject({ ok: true, jobId: "job-2" });
  });

  it("never reconciles an incumbent that has no run id", async () => {
    /**
     * The web editor runs this function INLINE, so its rows have no run id and
     * are alive exactly while they hold the slot. `reconcileJobWithRun` reads a
     * missing run id as "abandoned", so reconciling one would fail an edit that
     * is still running and let a second claim in beside it — two provider
     * calls, two charges, one overwriting the other.
     */
    claimJob.mockResolvedValue({
      claimed: false,
      job: { id: "job-inline", status: "RUNNING", triggerRunId: null },
    });

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(reconcileJobWithRun).not.toHaveBeenCalled();
    expect(claimJob).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ ok: false, code: "ALREADY_RUNNING" });
    expect(assertAiBudget).not.toHaveBeenCalled();
  });

  it("does not retry the claim while the incumbent run is still alive", async () => {
    // A genuinely concurrent edit must still lose — retrying past a live run
    // would charge the church twice for one prompt.
    const live = { id: "job-live", status: "RUNNING", triggerRunId: "run_live" };
    claimJob.mockResolvedValue({ claimed: false, job: live });
    reconcileJobWithRun.mockResolvedValue(live);
    isActiveStatus.mockReturnValue(true);

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack" });

    expect(outcome).toMatchObject({ ok: false, code: "ALREADY_RUNNING" });
    expect(claimJob).toHaveBeenCalledTimes(1);
    expect(assertAiBudget).not.toHaveBeenCalled();
  });

  it("records the run id with the claim so a dead run can be identified later", async () => {
    await runEditorPromptJob({ ...OWNED, source: "slack", triggerRunId: "run_abc" });

    expect(claimJob).toHaveBeenCalledWith(
      "site-1",
      "editor_prompt",
      expect.any(String),
      expect.objectContaining({ triggerRunId: "run_abc" })
    );
  });

  it("records where a Slack edit came from when it claims the slot", async () => {
    await runEditorPromptJob({
      ...OWNED,
      source: "slack",
      externalRef: { channelId: "C1", actorId: "U1" },
    });

    expect(claimJob).toHaveBeenCalledWith("site-1", "editor_prompt", OWNED.prompt, {
      source: "slack",
      slackChannelId: "C1",
      slackUserId: "U1",
    });
  });

  it("separates a spent monthly allowance from a short cooldown", async () => {
    assertAiBudget.mockRejectedValue(
      new AiBudgetExhaustedError("You have used all 150 AI edits for this month.", {
        used: 150,
        limit: 150,
        remaining: 0,
        resetsAt: new Date(),
      })
    );

    const exhausted = await runEditorPromptJob({ ...OWNED, source: "slack" });
    expect(exhausted).toMatchObject({ ok: false, code: "BUDGET_EXHAUSTED" });

    vi.clearAllMocks();
    site.findFirst.mockResolvedValue({ id: "site-1" });
    hasBasePlan.mockResolvedValue(true);
    claimJob.mockResolvedValue({ claimed: true, job: { id: "job-1" } });
    assertAiBudget.mockRejectedValue(new RateLimitError("Too many AI edits."));

    const cooling = await runEditorPromptJob({ ...OWNED, source: "slack" });
    expect(cooling).toMatchObject({ ok: false, code: "COOLDOWN" });
  });

  it("releases the slot when the budget refuses, and spends nothing", async () => {
    assertAiBudget.mockRejectedValue(new RateLimitError("Too many AI edits."));

    await runEditorPromptJob({ ...OWNED, source: "web" });

    // A QUEUED row left behind would jam every future edit for this site.
    expect(markJobFailed).toHaveBeenCalledWith("job-1", "This edit was not started.");
    expect(runEditorPrompt).not.toHaveBeenCalled();
  });

  it("only announces the edit after the claim and the budget have cleared", async () => {
    const order: string[] = [];
    claimJob.mockImplementation(async () => {
      order.push("claim");
      return { claimed: true, job: { id: "job-1" } };
    });
    assertAiBudget.mockImplementation(async () => {
      order.push("budget");
      return { remaining: 10 };
    });
    const onAccepted = vi.fn(async () => {
      order.push("announce");
      return { externalMessageId: "1700000000.000100" };
    });
    runEditorPrompt.mockImplementation(async () => {
      order.push("provider");
      return {
        summary: "Done.",
        path: "/",
        blocks: [],
        applied: true,
        improvements: [],
        designFeedback: [],
        mobileFeedback: [],
      };
    });

    await runEditorPromptJob({ ...OWNED, source: "slack", onAccepted });

    expect(order).toEqual(["claim", "budget", "announce", "provider"]);
  });

  it("never announces an edit that was refused", async () => {
    // Otherwise a cooldown leaves an orphaned "working on it…" in the church's
    // channel that nothing will ever update.
    claimJob.mockResolvedValue({ claimed: false, job: null });
    const onAccepted = vi.fn();

    await runEditorPromptJob({ ...OWNED, source: "slack", onAccepted });

    expect(onAccepted).not.toHaveBeenCalled();
  });

  it("treats a failed announcement as fatal, before the provider is called", async () => {
    // The bot was kicked from the bound channel. Failing here means the church
    // is not charged for an edit whose result they would never have seen.
    const onAccepted = vi.fn().mockRejectedValue(new Error("not_in_channel"));

    const outcome = await runEditorPromptJob({ ...OWNED, source: "slack", onAccepted });

    expect(outcome).toMatchObject({ ok: false, code: "POST_FAILED", jobId: "job-1" });
    expect(runEditorPrompt).not.toHaveBeenCalled();
    expect(markJobFailed).toHaveBeenCalled();
  });

  it("persists the announced message id so the reply can be updated in place", async () => {
    const onAccepted = vi.fn().mockResolvedValue({ externalMessageId: "1700000000.000100" });

    await runEditorPromptJob({ ...OWNED, source: "slack", onAccepted });

    expect(siteGenerationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { slackMessageTs: "1700000000.000100" },
    });
  });

  it("fails the job when the provider does, so the slot is not left held", async () => {
    runEditorPrompt.mockRejectedValue(new Error("model returned unusable JSON"));

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({ ok: false, code: "PROVIDER_FAILED" });
    expect(markJobFailed).toHaveBeenCalledWith("job-1", "model returned unusable JSON");
  });

  it("reports a retarget's budget refusal as a budget refusal, not a provider failure", async () => {
    // The second provider call is charged inside the run, so its refusal
    // arrives here as a thrown error rather than at the check above.
    runEditorPrompt.mockRejectedValue(
      new AiBudgetExhaustedError("You have used all 150 AI edits for this month.", {
        used: 150,
        limit: 150,
        remaining: 0,
        resetsAt: new Date(),
      })
    );

    const outcome = await runEditorPromptJob({ ...OWNED, source: "web" });

    expect(outcome).toMatchObject({ ok: false, code: "BUDGET_EXHAUSTED" });
  });
});
