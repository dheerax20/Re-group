import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import {
  parseDesignFeedback,
  parseImprovements,
  parseMobileFeedback,
  withStoryFeedback,
} from "@/lib/site/story";
import { HOME_PATH } from "@/lib/site/blocks/resolve-page";
import { hashBlocks } from "@/lib/site/blocks/fingerprint";
import { pageBlocksWriteOp, runPageEdit } from "./page-edit";

/**
 * The one-shot editor prompt, persisted.
 *
 * The page-resolution, retargeting and write rules all live in
 * `./page-edit.ts`, shared with the chatbot, so there is still one validated
 * way for a prompt to change a site.
 *
 * Note the write goes to `blockConfig` (home) or a `SitePage` row (everything
 * else) — never `sectionConfig`. That column is still read for the giving /
 * YouTube / podcast URLs and by legacy sites, but it stopped being the edit
 * target when this path was found to be writing to a column nothing rendered.
 */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type EditorPromptArgs = {
  siteId: string;
  prompt: string;
  path?: string;
  /** Re-run before a retarget's second provider call. */
  assertBudget?: () => Promise<void>;
  /**
   * The job this edit belongs to. When given, its undo snapshot is written in
   * the SAME transaction as the page itself.
   */
  jobId?: string;
};

export async function runEditorPrompt({
  siteId,
  prompt,
  path = HOME_PATH,
  assertBudget,
  jobId,
}: EditorPromptArgs) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true, storyConfig: true },
  });
  if (!site) throw new Error("Site not found");

  const result = await runPageEdit({ siteId, path, prompt, assertBudget });

  const storyOp = prisma.site.update({
    where: { id: siteId },
    data: {
      // Persisted rather than only returned: the editor's "Needs" checklist
      // reads these back off the site record, so they have to survive a reload.
      storyConfig: toJson(
        withStoryFeedback(site.storyConfig, {
          improvements: result.improvements,
          designFeedback: result.designFeedback,
          mobileFeedback: result.mobileFeedback,
        })
      ),
    },
  });

  if (result.changed) {
    /**
     * One transaction, three writes that must agree.
     *
     * These used to be separate statements, which left two windows a crash
     * could land in: the page written with stale feedback beside it, or —
     * once undo existed — a page written with no snapshot describing it, or a
     * snapshot pointing at a write that never happened. Undo is only
     * trustworthy if the snapshot cannot exist without its write.
     *
     * The snapshot is also taken HERE rather than before the provider call.
     * Taking it earlier would leave a phantom undo point behind every prompt
     * the model failed to act on.
     */
    const ops: Prisma.PrismaPromise<unknown>[] = [
      pageBlocksWriteOp(siteId, result.path, result.blocks),
      storyOp,
    ];

    if (jobId) {
      ops.push(
        prisma.siteGenerationJob.update({
          where: { id: jobId },
          data: {
            previousPath: result.path,
            previousBlocks: toJson(result.previousBlocks),
            previousPageExisted: result.previousPageExisted,
            /**
             * Only the three keys this edit overwrites, never the whole
             * column — the church's own story fields live there too, and
             * restoring those from a snapshot would undo edits nobody asked
             * to undo. Read through the dedicated parsers because these three
             * are written alongside `ChurchStory` rather than being part of
             * it.
             */
            previousStory: toJson({
              improvements: parseImprovements(site.storyConfig),
              designFeedback: parseDesignFeedback(site.storyConfig),
              mobileFeedback: parseMobileFeedback(site.storyConfig),
            }),
            writtenBlocksHash: hashBlocks(result.blocks),
          },
        })
      );
    }

    await prisma.$transaction(ops);
  } else {
    await storyOp;
  }

  await invalidateSite(siteId, { slug: site.slug });

  return {
    summary: result.summary,
    path: result.path,
    blocks: result.blocks,
    applied: result.changed,
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}
