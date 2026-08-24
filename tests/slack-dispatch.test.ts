import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What lands in a church's channel, and when.
 *
 * The invariants here are about restraint rather than function. A Slack
 * channel is a shared room: a refusal that gets posted to it, or a "working
 * on it…" that never resolves, is visible to everyone the church works with.
 * So the tests assert what is NOT posted at least as hard as what is —
 * refusals stay ephemeral, nothing is announced until the edit is genuinely
 * going to happen, and the single announcement is edited in place rather than
 * being followed by a second message.
 */
const postMessage = vi.fn();
const updateMessage = vi.fn();
const respondViaResponseUrl = vi.fn().mockResolvedValue({ ok: true, data: null });

vi.mock("@/lib/slack/api", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
  updateMessage: (...args: unknown[]) => updateMessage(...args),
  respondViaResponseUrl: (...args: unknown[]) => respondViaResponseUrl(...args),
}));

vi.mock("@/lib/slack/crypto", () => ({ decryptToken: () => "xoxb-test" }));

const authorizeSlackActor = vi.fn();
vi.mock("@/lib/slack/authorize", () => ({
  authorizeSlackActor: (...args: unknown[]) => authorizeSlackActor(...args),
}));

const runEditorPromptJob = vi.fn();
vi.mock("@/lib/ai/editor-prompt-run", () => ({
  runEditorPromptJob: (args: Record<string, unknown>) => runEditorPromptJob(args),
}));

const revertPageEdit = vi.fn();
vi.mock("@/lib/ai/revert-page-edit", () => ({
  revertPageEdit: (...args: unknown[]) => revertPageEdit(...args),
}));

vi.mock("@/lib/ai/usage", () => ({
  getAiBudget: async () => ({
    used: 2,
    limit: 150,
    remaining: 148,
    resetsAt: new Date("2026-09-01T00:00:00Z"),
  }),
}));

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { site: { findUnique: () => findUnique() } },
  withDbRetry: (fn: () => unknown) => fn(),
}));

vi.mock("@/lib/domains/actions-support", () => ({
  canonicalHostForSite: async () => "grace.regroup.test",
}));

const { buildStatus, handlePrompt, handleUndo } = await import("@/lib/slack/dispatch");

const CTX = {
  teamId: "T1",
  slackUserId: "U_OWNER",
  channelId: "C_BOUND",
  responseUrl: "https://hooks.slack.com/commands/T1/1/abc",
};

const AUTHORIZED = {
  ok: true as const,
  siteId: "site-1",
  userId: "user-1",
  connection: { botAccessToken: "encrypted", channelName: "website" },
};

function succeeded(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    jobId: "job-1",
    job: { id: "job-1" },
    path: "/",
    summary: "Warmed up the welcome message.",
    applied: true,
    blocks: [],
    improvements: [],
    designFeedback: [],
    mobileFeedback: [],
    ...overrides,
  };
}

/** Runs the job the way the real one does: announce, then succeed. */
function announcingRun(outcome: Record<string, unknown>) {
  return async (args: Record<string, unknown>) => {
    const onAccepted = args.onAccepted as
      | ((job: { id: string }) => Promise<{ externalMessageId?: string } | void>)
      | undefined;
    await onAccepted?.({ id: "job-1" });
    return outcome;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeSlackActor.mockResolvedValue(AUTHORIZED);
  postMessage.mockResolvedValue({ ok: true, data: { ts: "1700000000.000100" } });
  updateMessage.mockResolvedValue({ ok: true, data: { ts: "1700000000.000100" } });
  respondViaResponseUrl.mockResolvedValue({ ok: true, data: null });
  findUnique.mockResolvedValue({ slug: "grace", status: "PUBLISHED" });
  runEditorPromptJob.mockImplementation(announcingRun(succeeded()));
  revertPageEdit.mockResolvedValue({
    ok: true,
    jobId: "job-1",
    path: "/",
    alsoDiscarded: false,
  });
});

describe("handlePrompt", () => {
  it("keeps a refusal ephemeral and out of the channel entirely", async () => {
    authorizeSlackActor.mockResolvedValue({
      ok: false,
      code: "NOT_OWNER",
      message: "Only the Regroup account that connected this workspace can edit the site.",
    });

    await handlePrompt(CTX, "make the hero warmer");

    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
    // Nothing about being told "no" belongs in a room the whole church reads.
    expect(postMessage).not.toHaveBeenCalled();
    expect(runEditorPromptJob).not.toHaveBeenCalled();
  });

  it("announces the edit and then edits that same message with the result", async () => {
    await handlePrompt(CTX, "make the hero warmer");

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledTimes(1);

    const [, channel, ts, text] = updateMessage.mock.calls[0];
    expect(channel).toBe("C_BOUND");
    // The SAME message, not a second one below it.
    expect(ts).toBe("1700000000.000100");
    expect(text).toBe("Warmed up the welcome message.");
  });

  it("hands the actor and channel down so the job records where it came from", async () => {
    await handlePrompt(CTX, "make the hero warmer");

    expect(runEditorPromptJob).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "site-1",
        userId: "user-1",
        source: "slack",
        externalRef: { channelId: "C_BOUND", actorId: "U_OWNER" },
      })
    );
  });

  it("treats a channel it cannot post in as fatal, before the edit runs", async () => {
    // `onAccepted` throwing is what makes this pre-spend: the run never
    // reaches the provider.
    postMessage.mockResolvedValue({ ok: false, error: "not_in_channel" });
    let announceFailed = false;

    runEditorPromptJob.mockImplementation(async (args: Record<string, unknown>) => {
      const onAccepted = args.onAccepted as (job: { id: string }) => Promise<unknown>;
      try {
        await onAccepted({ id: "job-1" });
      } catch (error) {
        announceFailed = true;
        return { ok: false, code: "POST_FAILED", message: (error as Error).message };
      }
      return succeeded();
    });

    await handlePrompt(CTX, "make the hero warmer");

    expect(announceFailed).toBe(true);
    // And the church is told what to do about it, in words.
    const [, text] = respondViaResponseUrl.mock.calls[0];
    expect(text).toContain("Invite it back");
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it("replaces the announcement when the failure came after it", async () => {
    runEditorPromptJob.mockImplementation(
      announcingRun({ ok: false, code: "PROVIDER_FAILED", message: "The AI edit failed." })
    );

    await handlePrompt(CTX, "make the hero warmer");

    // Leaving "working on it…" up forever is worse than saying what happened.
    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage.mock.calls[0][3]).toBe("The AI edit failed.");
    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
  });

  it("posts no Undo button when the model changed nothing", async () => {
    runEditorPromptJob.mockImplementation(
      announcingRun(succeeded({ applied: false, summary: "No change was made." }))
    );

    await handlePrompt(CTX, "make the hero warmer");

    expect(JSON.stringify(updateMessage.mock.calls[0][4])).not.toContain("regroup_undo");
  });

  it("offers Undo for the job it actually ran", async () => {
    await handlePrompt(CTX, "make the hero warmer");

    const blocks = JSON.stringify(updateMessage.mock.calls[0][4]);
    expect(blocks).toContain("regroup_undo");
    expect(blocks).toContain("job-1");
  });

  it("names the page when the model retargets somewhere else", async () => {
    runEditorPromptJob.mockImplementation(
      announcingRun(succeeded({ path: "/about", summary: "Rewrote the story." }))
    );

    await handlePrompt(CTX, "change the heading on the about page");

    expect(JSON.stringify(updateMessage.mock.calls[0][4])).toContain("About");
  });

  it("falls back to an ephemeral when the result cannot be delivered", async () => {
    // The edit has already committed. Silence would leave the church staring
    // at "working on it…" describing a change that actually landed.
    updateMessage.mockResolvedValue({ ok: false, error: "message_not_found" });

    await handlePrompt(CTX, "make the hero warmer");

    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
    expect(respondViaResponseUrl.mock.calls[0][1]).toBe("Warmed up the welcome message.");
  });

  it("omits View site while the site is still a draft", async () => {
    findUnique.mockResolvedValue({ slug: "grace", status: "DRAFT" });

    await handlePrompt(CTX, "make the hero warmer");

    expect(JSON.stringify(updateMessage.mock.calls[0][4])).not.toContain("View site");
  });
});

describe("buildStatus", () => {
  it("reports the allowance and the live URL without posting anything", async () => {
    const message = await buildStatus(AUTHORIZED as never);

    expect(JSON.stringify(message.blocks)).toContain("148 of 150");
    expect(JSON.stringify(message.blocks)).toContain("grace.regroup.test");
    // Answered inside the acknowledgement — no bot token, no round-trip.
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("passes a refusal straight through", async () => {
    const message = await buildStatus({
      ok: false,
      code: "NO_ADDON",
      message: "Editing your website needs the Website Builder with AI add-on.",
    } as never);

    expect(message.text).toContain("Website Builder with AI add-on");
  });
});

describe("handleUndo", () => {
  it("authorizes the person who CLICKED, not whoever ran the edit", async () => {
    // A button in a channel is clickable by everyone who can see it, and its
    // payload says who pressed it, never who is entitled to.
    await handleUndo({ ...CTX, slackUserId: "U_BYSTANDER" }, { jobId: "job-1" });

    expect(authorizeSlackActor).toHaveBeenCalledWith("T1", "U_BYSTANDER", "C_BOUND");
  });

  it("refuses a bystander without touching the channel", async () => {
    authorizeSlackActor.mockResolvedValue({
      ok: false,
      code: "NOT_OWNER",
      message: "Only the Regroup account that connected this workspace can edit the site.",
    });

    await handleUndo({ ...CTX, slackUserId: "U_BYSTANDER" }, { jobId: "job-1" });

    expect(revertPageEdit).not.toHaveBeenCalled();
    // The message everyone else can see must look exactly as it did.
    expect(updateMessage).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
  });

  it("rewrites the original message, which takes the Undo button with it", async () => {
    await handleUndo(CTX, { jobId: "job-1", sourceMessageTs: "1700000000.000100" });

    expect(updateMessage).toHaveBeenCalledTimes(1);
    const [, , ts, text, blocks] = updateMessage.mock.calls[0];
    expect(ts).toBe("1700000000.000100");
    expect(text).toContain("Reverted");
    // A used button should not still look clickable to the next person.
    expect(JSON.stringify(blocks)).not.toContain("regroup_undo");
  });

  it("posts a new message when there is none to rewrite", async () => {
    // `/regroup undo` typed as a command has no source message.
    await handleUndo(CTX, {});

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it("undoes the job the button named, not merely the newest", async () => {
    await handleUndo(CTX, { jobId: "job-7" });

    expect(revertPageEdit).toHaveBeenCalledWith("site-1", "user-1", "job-7");
  });

  it("warns when the undo discarded more than it reversed", async () => {
    revertPageEdit.mockResolvedValue({
      ok: true,
      jobId: "job-1",
      path: "/",
      alsoDiscarded: true,
    });

    await handleUndo(CTX, { jobId: "job-1", sourceMessageTs: "1700000000.000100" });

    expect(JSON.stringify(updateMessage.mock.calls[0][4])).toContain("also discarded");
  });

  it("falls back to an ephemeral when the revert result cannot be delivered", async () => {
    updateMessage.mockResolvedValue({ ok: false, error: "message_not_found" });

    await handleUndo(CTX, { jobId: "job-1", sourceMessageTs: "1700000000.000100" });

    // The revert happened; silence would read as "nothing occurred".
    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
    expect(respondViaResponseUrl.mock.calls[0][1]).toContain("Reverted");
  });

  it("keeps a refusal ephemeral", async () => {
    revertPageEdit.mockResolvedValue({
      ok: false,
      code: "EXPIRED",
      message: "That edit is too old to undo from Slack.",
    });

    await handleUndo(CTX, { jobId: "job-1", sourceMessageTs: "1700000000.000100" });

    expect(respondViaResponseUrl).toHaveBeenCalledTimes(1);
    // The result message stays as it was: the edit still stands.
    expect(updateMessage).not.toHaveBeenCalled();
  });
});
