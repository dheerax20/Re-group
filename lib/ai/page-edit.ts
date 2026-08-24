import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { getPageBlocks, hasStoredPage, HOME_PATH } from "@/lib/site/blocks/resolve-page";
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
  /**
   * `path`'s tree as it was BEFORE this edit. Returned rather than re-read by
   * the caller because this function already resolved it, and reading it
   * again after a retarget would mean loading the whole site a second time to
   * snapshot the right page.
   */
  previousBlocks: PageBlocks;
  /**
   * Whether this page already had somewhere to live before the edit.
   *
   * Only ever false for a SECONDARY page, which is the case that matters:
   * a never-edited one has no `SitePage` row and recomputes its default on
   * every render, so undo has to delete the row this edit created rather than
   * freeze the page at that default forever. The homepage always has a home
   * (`Site.blockConfig`), so this is true for `/` regardless of whether the
   * tree happens to be empty.
   */
  previousPageExisted: boolean;
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

/**
 * The page write as an UNAWAITED Prisma operation.
 *
 * Prisma operations are lazy, so handing one back lets a caller put the page
 * write in the same `$transaction` as whatever else must land with it — the
 * undo snapshot, in particular, which is only trustworthy if it cannot exist
 * without the write it describes, or vice versa.
 *
 * This is the only place that knows the home/secondary split on the write
 * side: the homepage lives on `Site.blockConfig`, every other page on its own
 * `SitePage` row.
 */
export function pageBlocksWriteOp(
  siteId: string,
  path: string,
  blocks: PageBlocks
): Prisma.PrismaPromise<unknown> {
  if (path === HOME_PATH) {
    return prisma.site.update({
      where: { id: siteId },
      data: { blockConfig: toJson(blocks) },
    });
  }

  return prisma.sitePage.upsert({
    where: { siteId_path: { siteId, path } },
    create: { siteId, path, blockConfig: toJson(blocks) },
    update: { blockConfig: toJson(blocks) },
  });
}

/** Persists a page's tree to wherever that page lives. */
export async function writePageBlocks(
  siteId: string,
  path: string,
  blocks: PageBlocks
): Promise<void> {
  await pageBlocksWriteOp(siteId, path, blocks);
}

/**
 * Whether undo would find somewhere to put this page back.
 *
 * `hasStoredPage` answers a subtly different question for the homepage — it
 * reports whether the home tree is non-empty, not whether a row exists — and
 * the snapshot reads `false` as "delete the SitePage row". There is no
 * SitePage row for `/` to delete, so the homepage is always true here.
 */
function pageAlreadyExisted(siteConfig: SiteConfig, path: string): boolean {
  return path === HOME_PATH || hasStoredPage(siteConfig, path);
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
        previousBlocks: getPageBlocks(siteConfig, path),
        previousPageExisted: pageAlreadyExisted(siteConfig, path),
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
    previousBlocks: before,
    // Captured BEFORE the write, which is the whole point: after it, a
    // secondary page always has a row and undo could never tell that this
    // edit is what created it.
    previousPageExisted: pageAlreadyExisted(siteConfig, path),
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
