import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { getPageBlocks, HOME_PATH } from "@/lib/site/blocks/resolve-page";
import { applyBlockEdits } from "@/lib/site/blocks/patch";
import { editableSitePages, isEditablePath } from "@/lib/site/pages";
import type { PageBlocks } from "@/lib/site/blocks/types";
import type { SiteConfig } from "@/lib/site/types";
import { applyBlockAiPrompt, type BlockPromptResult, type ChatTurn } from "./block-prompt";

/**
 * One AI edit, applied to one page.
 *
 * Both edit surfaces — the editor's prompt box and the chatbot — come through
 * here, so there is still exactly one validated way for a prompt to change a
 * site. What this adds over calling the prompt directly is everything that is
 * about *which page*: resolving the right tree, letting the model retarget to
 * another page, and writing back to the right place.
 */

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type PageEditResult = {
  /** The page actually edited, which may differ from the one requested. */
  path: string;
  blocks: PageBlocks;
  changed: boolean;
  summary: string;
  improvements: BlockPromptResult["improvements"];
  designFeedback: BlockPromptResult["designFeedback"];
  mobileFeedback: BlockPromptResult["mobileFeedback"];
};

/** The site row plus everything `toSiteConfig` needs. */
export async function loadSiteConfig(siteId: string): Promise<{
  siteConfig: SiteConfig;
  slug: string;
}> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { socialLinks: true, pages: true },
  });
  if (!site) throw new Error("Site not found");
  return { siteConfig: toSiteConfig(site), slug: site.slug };
}

/**
 * Records pasted media so a future upload/library feature already knows about
 * every image a church has used. Best-effort: a bookkeeping failure must not
 * fail an edit the church can see worked.
 */
async function recordMedia(siteId: string, before: PageBlocks, after: PageBlocks) {
  const videoUrls = new Set<string>();
  const urlsIn = (nodes: PageBlocks, into: Map<string, string | undefined>) => {
    for (const node of nodes) {
      if (node.type === "image") {
        if (node.src) into.set(node.src, node.alt);
        if (node.videoSrc) {
          into.set(node.videoSrc, node.alt);
          videoUrls.add(node.videoSrc);
        }
      }
      if ("children" in node && Array.isArray(node.children)) urlsIn(node.children, into);
    }
    return into;
  };

  const had = urlsIn(before, new Map());
  const has = urlsIn(after, new Map());
  const added = [...has].filter(([url]) => !had.has(url));
  if (added.length === 0) return;

  try {
    const existing = await prisma.media.findMany({
      where: { siteId, url: { in: added.map(([url]) => url) } },
      select: { url: true },
    });
    const known = new Set(existing.map((m) => m.url));
    const rows = added
      .filter(([url]) => !known.has(url))
      .map(([url, altText]) => ({
        siteId,
        url,
        altText: altText ?? null,
        // `videoSrc` is the reliable signal; the URL pattern only has to catch
        // the case where a video URL was pasted into `src`.
        type: videoUrls.has(url) || /youtu\.?be|vimeo\.|\.(mp4|webm|mov)(\?|$)/i.test(url)
          ? ("VIDEO" as const)
          : ("IMAGE" as const),
      }));
    // No unique constraint on (siteId, url), so concurrent edits can duplicate
    // a row. Harmless for a bookkeeping table, and cheaper than a migration.
    if (rows.length > 0) await prisma.media.createMany({ data: rows });
  } catch (error) {
    console.error("[page-edit] could not record media", error);
  }
}

/** Persists a page's tree to wherever that page lives. */
export async function writePageBlocks(
  siteId: string,
  path: string,
  blocks: PageBlocks
): Promise<void> {
  if (path === HOME_PATH) {
    await prisma.site.update({
      where: { id: siteId },
      data: { blockConfig: toJson(blocks) },
    });
    return;
  }

  await prisma.sitePage.upsert({
    where: { siteId_path: { siteId, path } },
    create: { siteId, path, blockConfig: toJson(blocks) },
    update: { blockConfig: toJson(blocks) },
  });
}

/**
 * Runs one prompt against one page and returns the new tree (unwritten).
 *
 * When the model answers with a different `page`, the prompt is re-run against
 * that page's blocks — the ids it was shown belong to the page it was shown,
 * so its patches cannot simply be redirected. That costs a second call, but
 * only on a retarget, and it is what makes "change the subtitle on the about
 * page" work while the editor is showing the homepage.
 */
export async function runPageEdit(args: {
  siteId: string;
  path: string;
  prompt: string;
  history?: ChatTurn[];
  /**
   * Charged before each provider call. A retarget makes a SECOND call, and
   * CLAUDE.md requires the budget be asserted before the call, not once per
   * request — so the caller hands us its own budget check to re-run.
   */
  assertBudget?: () => Promise<void>;
}): Promise<PageEditResult> {
  const { siteConfig } = await loadSiteConfig(args.siteId);
  const features = siteConfig.features;

  const requested = isEditablePath(args.path, features) ? args.path : HOME_PATH;
  const pages = editableSitePages(features).map((p) => ({ href: p.href, label: p.label }));

  const call = (path: string) =>
    applyBlockAiPrompt({
      churchName: siteConfig.site.name,
      prompt: args.prompt,
      blocks: getPageBlocks(siteConfig, path),
      features: features as unknown as Record<string, unknown>,
      page: path,
      editablePages: pages,
      history: args.history,
    });

  let path = requested;
  let result = await call(path);

  const retarget = result.page && result.page !== path ? result.page : null;
  if (retarget) {
    if (!isEditablePath(retarget, features)) {
      // The model named a page it may not touch (a sermons/events listing, or
      // a feature that is switched off). Saying so beats applying its patches
      // to the page it was actually shown, which is not what was asked for.
      const label = retarget;
      return {
        path,
        blocks: getPageBlocks(siteConfig, path),
        changed: false,
        summary: `${label} isn't a page I can edit — its content comes from your sermons, events and settings rather than editable text.`,
        improvements: result.improvements,
        designFeedback: result.designFeedback,
        mobileFeedback: result.mobileFeedback,
      };
    }
    // A second provider call, so a second budget check.
    await args.assertBudget?.();
    path = retarget;
    result = await call(path);
  }

  const before = getPageBlocks(siteConfig, path);
  const blocks = applyBlockEdits(before, {
    patches: result.patches,
    additions: result.additions,
  });

  /**
   * Whether anything ACTUALLY changed, not whether the model returned edits.
   *
   * Patches naming ids that don't exist are ignored by `applyBlockEdits`, and
   * counting them as a change wrote a byte-identical tree, blew away the
   * site's caches, and showed the church an "Applied" badge for nothing.
   */
  const changed = JSON.stringify(blocks) !== JSON.stringify(before);
  if (changed) await recordMedia(args.siteId, before, blocks);

  return {
    path,
    blocks,
    changed,
    summary:
      (changed && result.summary) ||
      (changed
        ? "Updated the page."
        : "No change was made — try naming the section you want changed."),
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}
