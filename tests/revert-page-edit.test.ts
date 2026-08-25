import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Undo.
 *
 * Every rule here exists because the alternative destroys work a church
 * cannot get back. The cases that matter most:
 *
 * - It must not CHARGE. `claimJob` writes an `editor_prompt` row and the
 *   monthly cap counts those rows, so claiming a slot to undo would bill the
 *   church for undoing something.
 * - It must not reach past the edit it reverses. Navigation, the church's own
 *   story fields, `styleName` and every other page were not part of the edit.
 * - For a page the edit CREATED, restoring the old tree is wrong: the row has
 *   to be deleted so the page goes back to recomputing its default.
 */
const site = { findFirst: vi.fn(), update: vi.fn() };
const sitePage = { upsert: vi.fn(), deleteMany: vi.fn() };
const siteGenerationJob = { findFirst: vi.fn(), update: vi.fn() };
const $transaction = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: { site, sitePage, siteGenerationJob, $transaction: (ops: unknown) => $transaction(ops) },
  withDbRetry: (fn: () => unknown) => fn(),
}));

const findActiveJob = vi.fn();
const claimJob = vi.fn();
vi.mock("@/lib/ai/generation-job", () => ({
  findActiveJob: () => findActiveJob(),
  // Exposed so the test below can prove it is never reached, not because
  // anything here is expected to call it.
  claimJob: () => claimJob(),
}));

const currentBlocks = vi.fn();
vi.mock("@/lib/ai/page-edit", () => ({
  loadSiteConfig: async () => ({ siteConfig: {}, slug: "grace" }),
}));

vi.mock("@/lib/site/blocks/resolve-page", async () => {
  const actual = await vi.importActual<typeof import("@/lib/site/blocks/resolve-page")>(
    "@/lib/site/blocks/resolve-page"
  );
  return { ...actual, getPageBlocks: () => currentBlocks() };
});

const invalidateSite = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/site/invalidate", () => ({ invalidateSite: () => invalidateSite() }));

const { hashBlocks } = await import("@/lib/site/blocks/fingerprint");
const { revertPageEdit, UNDO_WINDOW_MS } = await import("@/lib/ai/revert-page-edit");

const PREVIOUS = [{ id: "hero", type: "heading", text: "Welcome" }];
const WRITTEN = [{ id: "hero", type: "heading", text: "Welcome, friend" }];

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    siteId: "site-1",
    kind: "editor_prompt",
    previousPath: "/",
    previousBlocks: PREVIOUS,
    previousPageExisted: true,
    previousStory: { improvements: [], designFeedback: [], mobileFeedback: [] },
    writtenBlocksHash: hashBlocks(WRITTEN as never),
    revertedAt: null,
    finishedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** The ops array handed to `$transaction`, by the model each targeted. */
function transactionTargets(): string[] {
  const calls = [
    ...site.update.mock.calls.map(() => "site.update"),
    ...sitePage.upsert.mock.calls.map(() => "sitePage.upsert"),
    ...sitePage.deleteMany.mock.calls.map(() => "sitePage.deleteMany"),
    ...siteGenerationJob.update.mock.calls.map(() => "job.update"),
  ];
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  site.findFirst.mockResolvedValue({ id: "site-1", slug: "grace", storyConfig: {} });
  site.update.mockReturnValue({ op: "site.update" });
  sitePage.upsert.mockReturnValue({ op: "sitePage.upsert" });
  sitePage.deleteMany.mockReturnValue({ op: "sitePage.deleteMany" });
  siteGenerationJob.update.mockReturnValue({ op: "job.update" });
  siteGenerationJob.findFirst.mockResolvedValue(job());
  findActiveJob.mockResolvedValue(null);
  currentBlocks.mockReturnValue(WRITTEN);
  $transaction.mockResolvedValue([]);
});

describe("revertPageEdit", () => {
  it("restores the homepage tree and closes the job out", async () => {
    const outcome = await revertPageEdit("site-1", "user-1");

    expect(outcome).toMatchObject({ ok: true, jobId: "job-1", path: "/", alsoDiscarded: false });
    expect(transactionTargets()).toContain("site.update");
    expect(transactionTargets()).toContain("job.update");
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(invalidateSite).toHaveBeenCalled();
  });

  it("never claims a job slot, because that would bill the church", async () => {
    // `claimJob` creates an `editor_prompt` row, and `lib/ai/usage.ts` counts
    // those rows against the monthly allowance — so reaching for it here
    // would charge a church for undoing something.
    await revertPageEdit("site-1", "user-1");

    expect(claimJob).not.toHaveBeenCalled();
    // The cheap check it uses instead, which writes nothing.
    expect(findActiveJob).toHaveBeenCalled();
  });

  it("upserts a secondary page that already had a row", async () => {
    siteGenerationJob.findFirst.mockResolvedValue(
      job({ previousPath: "/about", previousPageExisted: true })
    );

    await revertPageEdit("site-1", "user-1");

    expect(transactionTargets()).toContain("sitePage.upsert");
    expect(transactionTargets()).not.toContain("sitePage.deleteMany");
  });

  it("DELETES a secondary page the edit itself created", async () => {
    // Writing the old tree back would freeze the page at whatever default it
    // was showing, permanently, because every later render reads the row
    // instead of recomputing.
    siteGenerationJob.findFirst.mockResolvedValue(
      job({ previousPath: "/about", previousPageExisted: false })
    );

    await revertPageEdit("site-1", "user-1");

    expect(transactionTargets()).toContain("sitePage.deleteMany");
    expect(transactionTargets()).not.toContain("sitePage.upsert");
  });

  it("merges the feedback keys instead of overwriting the story column", async () => {
    site.findFirst.mockResolvedValue({
      id: "site-1",
      slug: "grace",
      storyConfig: { styleName: "Quiet Modern", pastorName: "Sam Reyes" },
    });

    await revertPageEdit("site-1", "user-1");

    const storyWrite = site.update.mock.calls.find(
      (call) => (call[0] as { data?: Record<string, unknown> }).data?.storyConfig
    );
    const written = (storyWrite?.[0] as { data: { storyConfig: Record<string, unknown> } }).data
      .storyConfig;

    // The church's own fields were never part of the edit being undone.
    expect(written.styleName).toBe("Quiet Modern");
    expect(written.pastorName).toBe("Sam Reyes");
  });

  it("refuses a second undo of the same edit", async () => {
    siteGenerationJob.findFirst.mockResolvedValue(job({ revertedAt: new Date() }));

    const outcome = await revertPageEdit("site-1", "user-1");

    expect(outcome).toMatchObject({ ok: false, code: "ALREADY_REVERTED" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("refuses to undo an edit that is no longer the most recent", async () => {
    // Undoing it would silently discard everything that came after.
    siteGenerationJob.findFirst
      .mockResolvedValueOnce(job({ id: "job-2" }))
      .mockResolvedValueOnce(job({ id: "job-1" }));

    const outcome = await revertPageEdit("site-1", "user-1", "job-1");

    expect(outcome).toMatchObject({ ok: false, code: "NOT_LATEST" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("refuses once the window has passed", async () => {
    // The button stays in the channel forever; nothing about it says how old
    // it is, so Thursday's click on Tuesday's button must not land.
    siteGenerationJob.findFirst.mockResolvedValue(
      job({ finishedAt: new Date(Date.now() - UNDO_WINDOW_MS - 1000) })
    );

    const outcome = await revertPageEdit("site-1", "user-1");

    expect(outcome).toMatchObject({ ok: false, code: "EXPIRED" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("refuses while an edit is running", async () => {
    findActiveJob.mockResolvedValue({ id: "job-running" });

    const outcome = await revertPageEdit("site-1", "user-1");

    expect(outcome).toMatchObject({ ok: false, code: "BUSY" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("says when there is nothing to undo", async () => {
    siteGenerationJob.findFirst.mockResolvedValue(null);

    expect(await revertPageEdit("site-1", "user-1")).toMatchObject({
      ok: false,
      code: "NOTHING_TO_UNDO",
    });
  });

  it("refuses a site the caller does not own", async () => {
    site.findFirst.mockResolvedValue(null);

    expect(await revertPageEdit("site-1", "someone-else")).toMatchObject({
      ok: false,
      code: "NO_SITE",
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("still reverts when the page changed since, but says so", async () => {
    // Someone edited in the web editor after this edit. Undo wins, because
    // that is what was asked for — but the church is told what went with it.
    currentBlocks.mockReturnValue([{ id: "hero", type: "heading", text: "Something else" }]);

    const outcome = await revertPageEdit("site-1", "user-1");

    expect(outcome).toMatchObject({ ok: true, alsoDiscarded: true });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("does not cry wolf when the page is untouched", async () => {
    // The hash is compared across a jsonb round trip, so key order must not
    // register as a change or this warning would fire every single time.
    currentBlocks.mockReturnValue([{ text: "Welcome, friend", type: "heading", id: "hero" }]);

    expect(await revertPageEdit("site-1", "user-1")).toMatchObject({ alsoDiscarded: false });
  });
});
