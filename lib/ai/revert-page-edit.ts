import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { repairBlocks } from "@/lib/site/blocks/schema";
import { hashBlocks } from "@/lib/site/blocks/fingerprint";
import { getPageBlocks, HOME_PATH } from "@/lib/site/blocks/resolve-page";
import {
  parseDesignFeedback,
  parseImprovements,
  parseMobileFeedback,
  withStoryFeedback,
} from "@/lib/site/story";
import { findActiveJob } from "./generation-job";
import { loadSiteConfig } from "./page-edit";

/**
 * Putting one AI edit back.
 *
 * Undo here is deliberately small: exactly one edit, exactly one page, and
 * only for a short while. It is not version history — it is the "that isn't
 * what I meant" button, and every restriction below exists because the
 * alternative silently destroys work.
 *
 * Three things this must never do:
 *
 * - **Charge for itself.** `claimJob` writes an `editor_prompt` row, and
 *   `lib/ai/usage.ts` counts those rows against the monthly cap — so claiming
 *   a slot to undo would bill the church for undoing something. The
 *   concurrency guard here is a check plus a transaction, not a claim.
 * - **Reach past the edit it is reversing.** Only the page's tree and the
 *   three AI-feedback keys are restored. Navigation, the church's story
 *   fields, `sectionConfig` and every other page are left exactly as they
 *   are, because nothing about them was part of the edit.
 * - **Trust what it stored.** The snapshot is a `Json` column, which is
 *   untrusted input like any other, so it goes through `repairBlocks` on the
 *   way back in.
 */

/**
 * How long an edit stays undoable, from when it finished.
 *
 * Without a window, Tuesday's Undo button clicked on Thursday silently throws
 * away two days of editor work — the button is still sitting in the channel,
 * and nothing about it says how old it is.
 */
export const UNDO_WINDOW_MS = 15 * 60 * 1000;

export type RevertFailureCode =
  | "NO_SITE"
  | "NOTHING_TO_UNDO"
  | "NOT_LATEST"
  | "ALREADY_REVERTED"
  | "EXPIRED"
  | "BUSY";

export type RevertOutcome =
  | {
      ok: true;
      jobId: string;
      path: string;
      /**
       * True when the page had changed again after the edit being undone, so
       * this discarded more than it reversed. The church is told.
       */
      alsoDiscarded: boolean;
    }
  | { ok: false; code: RevertFailureCode; message: string };

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function refuse(code: RevertFailureCode, message: string): RevertOutcome {
  return { ok: false, code, message };
}

export async function revertPageEdit(
  siteId: string,
  userId: string,
  jobId?: string
): Promise<RevertOutcome> {
  // Re-asserted here for the same reason the edit run does it: this function
  // has callers that arrive without a session.
  const site = await prisma.site.findFirst({
    where: { id: siteId, userId },
    select: { id: true, slug: true, storyConfig: true },
  });
  if (!site) return refuse("NO_SITE", "That site is not yours.");

  /**
   * The newest edit that left a snapshot. `previousBlocks` being non-null is
   * the definition of "undoable" — a prompt the model could not act on wrote
   * no snapshot, and should not shadow the edit before it.
   */
  const latest = await prisma.siteGenerationJob.findFirst({
    where: { siteId, kind: "editor_prompt", previousBlocks: { not: Prisma.DbNull } },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return refuse("NOTHING_TO_UNDO", "There's no recent AI edit to undo.");
  }

  const job = jobId
    ? await prisma.siteGenerationJob.findFirst({ where: { id: jobId, siteId } })
    : latest;

  if (!job || !job.previousBlocks || !job.previousPath) {
    return refuse("NOTHING_TO_UNDO", "There's no recent AI edit to undo.");
  }

  if (job.revertedAt) {
    // A button in a channel can be clicked twice, by two people. The second
    // click is not an error, it is a question already answered.
    return refuse("ALREADY_REVERTED", "That edit has already been undone.");
  }

  if (job.id !== latest.id) {
    return refuse(
      "NOT_LATEST",
      "That's no longer the most recent change, so undoing it would discard newer edits. Open the editor to change it back."
    );
  }

  const finishedAt = job.finishedAt ?? job.updatedAt;
  if (Date.now() - finishedAt.getTime() > UNDO_WINDOW_MS) {
    return refuse(
      "EXPIRED",
      "That edit is too old to undo from Slack. Open the editor to change it back."
    );
  }

  /**
   * Not `claimJob` — see the note at the top. This is a cheap early answer
   * for the common case; the real protection is that the restore below is one
   * transaction, so an edit landing concurrently either precedes it entirely
   * or follows it entirely.
   */
  if (await findActiveJob(siteId, "editor_prompt")) {
    return refuse("BUSY", "An AI edit is running right now. Try undoing once it finishes.");
  }

  const path = job.previousPath;
  const { siteConfig } = await loadSiteConfig(siteId);
  const current = getPageBlocks(siteConfig, path);

  /**
   * Whether the page still looks the way this edit left it. A mismatch does
   * not block the undo — the church asked for it — but it changes what they
   * are told, because more is being thrown away than they clicked for.
   */
  const alsoDiscarded = job.writtenBlocksHash
    ? hashBlocks(current) !== job.writtenBlocksHash
    : false;

  /**
   * `repairBlocks`, never `coerceBlocks`.
   *
   * `coerceBlocks` drops a whole top-level node when any descendant fails to
   * parse, which on a restore would cost the church an entire band over one
   * bad leaf — the opposite of what undo is for.
   */
  const restored = repairBlocks(job.previousBlocks);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    restorePageOp(siteId, path, restored, job.previousPageExisted !== false),
    prisma.site.update({
      where: { id: siteId },
      data: {
        /**
         * Merged into the CURRENT column, not written over it. The snapshot
         * holds only the three keys the edit touched; `storyConfig` also
         * carries the church's own story fields, `styleName` and `agentLog`,
         * and none of those were part of the edit being undone.
         */
        storyConfig: toJson(
          withStoryFeedback(site.storyConfig, {
            improvements: parseImprovements(job.previousStory),
            designFeedback: parseDesignFeedback(job.previousStory),
            mobileFeedback: parseMobileFeedback(job.previousStory),
          })
        ),
      },
    }),
    prisma.siteGenerationJob.update({
      where: { id: job.id },
      data: {
        revertedAt: new Date(),
        // Insurance, not a redo: there is no UI to replay this, but a church
        // asking "where did my change go" deserves an answer that exists.
        revertedBlocks: toJson(current),
      },
    }),
  ];

  await prisma.$transaction(ops);
  await invalidateSite(siteId, { slug: site.slug });

  return { ok: true, jobId: job.id, path, alsoDiscarded };
}

/**
 * Puts a page back where it came from.
 *
 * The subtle case is a secondary page this edit CREATED. A never-edited page
 * has no `SitePage` row and recomputes its default from the church's brand
 * and features on every render; writing the old tree back would freeze it at
 * whatever that default happened to be, permanently, because every later
 * render would read the row instead of recomputing. Deleting the row is what
 * actually restores the previous behaviour.
 */
function restorePageOp(
  siteId: string,
  path: string,
  blocks: ReturnType<typeof repairBlocks>,
  pageExisted: boolean
): Prisma.PrismaPromise<unknown> {
  if (path === HOME_PATH) {
    return prisma.site.update({
      where: { id: siteId },
      data: { blockConfig: toJson(blocks) },
    });
  }

  if (!pageExisted) {
    // `deleteMany` rather than `delete`: the row may already be gone, and a
    // P2025 would abort a transaction that has nothing left to do anyway.
    return prisma.sitePage.deleteMany({ where: { siteId, path } });
  }

  return prisma.sitePage.upsert({
    where: { siteId_path: { siteId, path } },
    create: { siteId, path, blockConfig: toJson(blocks) },
    update: { blockConfig: toJson(blocks) },
  });
}
