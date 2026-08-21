import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { parseChurchStory } from "@/lib/site/story";
import { HOME_PATH } from "@/lib/site/blocks/resolve-page";
import { runPageEdit, writePageBlocks } from "./page-edit";

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

export async function runEditorPrompt(
  siteId: string,
  prompt: string,
  path: string = HOME_PATH,
  /** Re-run before a retarget's second provider call. */
  assertBudget?: () => Promise<void>
) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true, storyConfig: true },
  });
  if (!site) throw new Error("Site not found");

  const result = await runPageEdit({ siteId, path, prompt, assertBudget });

  if (result.changed) {
    await writePageBlocks(siteId, result.path, result.blocks);
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      // Persisted rather than only returned: the editor's "Needs" checklist
      // reads these back off the site record, so they have to survive a reload.
      storyConfig: toJson({
        ...parseChurchStory(site.storyConfig),
        improvements: result.improvements,
        designFeedback: result.designFeedback,
        mobileFeedback: result.mobileFeedback,
      }),
    },
  });

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
