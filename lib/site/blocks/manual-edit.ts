import { getPageBlocks } from "@/lib/site/blocks/resolve-page";
import { applyBlockEdits, reorderTopLevel } from "@/lib/site/blocks/patch";
import { repairBlocks } from "@/lib/site/blocks/schema";
import { enforceBlockLegibility } from "@/lib/site/blocks/design-pass";
import { isEditablePath } from "@/lib/site/pages";
import { invalidateSite } from "@/lib/site/invalidate";
import { loadSiteConfig, writePageBlocks } from "@/lib/ai/page-edit";
import type { PageBlocks, TypeScaleToken } from "@/lib/site/blocks/types";

/**
 * Direct, non-AI edits to a page's block tree.
 *
 * The editor's outline panel reorders bands and sets a heading's font size
 * without spending a chat message, so those writes cannot go through
 * `runPageEdit`. What they DO share is everything after the model: the same
 * `applyBlockEdits`, so the panel is held to the same rules a patch from the
 * model is — the per-type `EDITABLE` whitelist, protected nav/footer subtrees,
 * URL validation, `repairBlocks` and `enforceBlockLegibility`.
 *
 * The client is the site's own owner (`paidSiteProcedure`), so this is not a
 * trust boundary in the way the model is. It is still validated the same way:
 * a bug in the panel should cost a rejected field, not a broken page.
 */
export type ManualBlockEdit = {
  path: string;
  /** Top-level band ids in their new order. See `reorderTopLevel`. */
  order?: string[];
  /**
   * Deliberately narrower than `BlockPatch`.
   *
   * The panel only ever sets a font size, and widening this to the full patch
   * vocabulary would put `remove`, `href` and `src` on a route with no UI
   * behind it — and an image set this way would skip the `Media` bookkeeping
   * that `runPageEdit` does, quietly diverging the two write paths.
   */
  scales?: Array<{ id: string; scale: TypeScaleToken }>;
};

/** Raised when the caller names a page whose content is not a block tree. */
export class UneditablePageError extends Error {}

export async function updatePageBlocks(
  siteId: string,
  edit: ManualBlockEdit
): Promise<{ path: string; blocks: PageBlocks; changed: boolean }> {
  const { siteConfig, slug } = await loadSiteConfig(siteId);

  if (!isEditablePath(edit.path, siteConfig.features)) {
    throw new UneditablePageError("That page's content cannot be edited here.");
  }

  const before = getPageBlocks(siteConfig, edit.path);

  let blocks = before;
  if (edit.order && edit.order.length > 0) blocks = reorderTopLevel(blocks, edit.order);
  if (edit.scales && edit.scales.length > 0) {
    blocks = applyBlockEdits(blocks, { patches: edit.scales });
  } else if (blocks !== before) {
    // `applyBlockEdits` ends in repair + legibility; a reorder-only write has
    // to reach the same finish, because CLAUDE.md's rule is that model-shaped
    // data is coerced at the write site every time, not most times.
    blocks = enforceBlockLegibility(repairBlocks(blocks));
  }

  // Same test the AI path uses: whether the TREE changed, not whether the
  // client sent something. A no-op drag must not blow away the site's caches.
  const changed = JSON.stringify(blocks) !== JSON.stringify(before);
  if (changed) {
    await writePageBlocks(siteId, edit.path, blocks);
    await invalidateSite(siteId, { slug });
  }

  return { path: edit.path, blocks, changed };
}
