import { z } from "zod";
import { linkTargetSchema, mediaUrlSchema, safeMediaUrl } from "@/lib/validation/url";
import { blockNodeSchema, ensureBlockIds, repairBlocks } from "./schema";
import { enforceBlockLegibility } from "./design-pass";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID, type BlockNode, type PageBlocks } from "./types";

/**
 * Targeted edits to an already-composed block tree.
 *
 * The AI edit path used to hand the model a `SectionInstance[]` and take a
 * whole new one back — a shape the renderer stopped reading, which is why
 * edits from the builder appeared to do nothing at all. Asking the model for
 * a whole new BLOCK tree instead would have fixed the column but introduced a
 * worse problem: every "shorten the headline" would be a full redesign, and a
 * church would lose a layout they were happy with over a one-line request.
 *
 * So an edit is a list of patches against ids that already exist. The model
 * cannot add a node, cannot reorder the page, and cannot touch an id it was
 * not shown. The worst a bad reply can do is leave the page as it was.
 */

/**
 * One patch, as a flat all-optional object.
 *
 * Deliberately NOT a discriminated union keyed on an `op`. zod v4 emits
 * `oneOf` for a discriminated union and OpenAI rejects the request outright
 * (`400 … 'oneOf' is not permitted`) — the exact failure `toOpenAiJsonSchema`
 * in `lib/ai/agents/specialists.ts` exists to work around. A flat shape needs
 * no rewriting, and the per-type whitelist below does the narrowing that a
 * union would have.
 */
export const blockPatchSchema = z.object({
  id: z.string().trim().min(1).max(60),
  /** heading / text / eyebrow copy. */
  text: z.string().trim().max(600).optional(),
  /** button label. */
  label: z.string().trim().max(60).optional(),
  /** button target. Validated as a link target, same as every other href. */
  href: z.string().trim().max(200).optional(),
  scale: z.enum(["display", "h1", "h2", "h3", "body", "small"]).optional(),
  accent: z.enum(["none", "line", "bordered", "numbered"]).optional(),
  emphasis: z.enum(["primary", "secondary", "outline"]).optional(),
  /** An https image URL the church supplied. Never invented by the model. */
  src: mediaUrlSchema.optional(),
  /** An https video URL; YouTube links render as an embed. */
  videoSrc: mediaUrlSchema.optional(),
  alt: z.string().trim().max(200).optional(),
  treatment: z.enum(["rounded", "square", "framed", "bleed"]).optional(),
  aspect: z.enum(["square", "video", "portrait", "wide", "cinema"]).optional(),
  layout: z.enum(["grid", "list", "featured", "calendar"]).optional(),
  limit: z.number().int().min(1).max(12).optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  style: z
    .object({
      padding: z.enum(["none", "xs", "sm", "md", "lg", "xl", "2xl"]).optional(),
      gap: z.enum(["none", "xs", "sm", "md", "lg", "xl", "2xl"]).optional(),
      align: z.enum(["left", "center", "right"]).optional(),
      width: z.enum(["narrow", "normal", "wide", "full"]).optional(),
      background: z
        .enum(["transparent", "surface", "primary", "accent", "inverted"])
        .optional(),
      textTone: z.enum(["default", "muted", "inverted", "accent"]).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(200),
      })
    )
    .max(8)
    .optional(),
  /** Removes the node entirely. Nav and footer bands are exempt. */
  remove: z.boolean().optional(),
});

export type BlockPatch = z.infer<typeof blockPatchSchema>;

/**
 * Which patch fields each block type will actually accept.
 *
 * A patch naming a field the target type has no concept of is dropped rather
 * than applied — `{ id: "hero-photo", text: "…" }` must not smuggle a `text`
 * property onto an image block and get it pruned by `coerceBlocks` later,
 * taking the whole node with it.
 */
const EDITABLE: Record<string, ReadonlySet<string>> = {
  section: new Set(["style"]),
  stack: new Set(["style"]),
  row: new Set(["style", "columns"]),
  spacer: new Set(["style"]),
  heading: new Set(["style", "text", "scale"]),
  text: new Set(["style", "text", "scale"]),
  eyebrow: new Set(["style", "text", "accent"]),
  image: new Set(["style", "treatment", "aspect", "src", "videoSrc", "alt"]),
  button: new Set(["style", "label", "href", "emphasis"]),
  stats: new Set(["style"]),
  navLinks: new Set(["style"]),
  brandLogo: new Set(["style"]),
  sermonCollection: new Set(["style", "layout", "limit"]),
  eventCollection: new Set(["style", "layout", "limit"]),
  ministryCollection: new Set(["style", "items"]),
  contactInfo: new Set(["style"]),
  givingCta: new Set(["style"]),
  socialLinks: new Set(["style"]),
  copyrightLine: new Set(["style"]),
};

/** Layout values each collection type actually implements. */
const COLLECTION_LAYOUTS: Record<string, ReadonlySet<string>> = {
  sermonCollection: new Set(["grid", "list", "featured"]),
  eventCollection: new Set(["grid", "list", "calendar"]),
};

const PROTECTED_IDS: ReadonlySet<string> = new Set([NAV_BLOCK_ID, FOOTER_BLOCK_ID]);

/**
 * Everything inside the nav and footer bands, not just the bands themselves.
 *
 * Those bands render on EVERY page, and their children are the site's
 * navigation and copyright line. Guarding only the two band ids meant
 * `{ id: "nav-links", remove: true }` deleted the navigation site-wide, and an
 * addition anchored to a nav child inserted a heading between the logo and the
 * links — both reachable from an ordinary request, since the prompt invites
 * anchoring to nested ids.
 */
function protectedSubtreeIds(blocks: PageBlocks): Set<string> {
  const ids = new Set<string>();
  const collect = (node: BlockNode) => {
    ids.add(node.id);
    if ("children" in node && Array.isArray(node.children)) node.children.forEach(collect);
  };
  for (const node of blocks) {
    if (PROTECTED_IDS.has(node.id)) collect(node);
  }
  return ids;
}

function applyOne(node: BlockNode, patch: BlockPatch): BlockNode {
  const allowed = EDITABLE[node.type];
  if (!allowed) return node;

  const next = { ...node } as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch)) {
    if (key === "id" || key === "remove" || value === undefined) continue;
    if (!allowed.has(key)) continue;

    /**
     * An empty string means "leave this alone", never "make it empty".
     *
     * `blockNodeSchema` requires `min(1)` on a heading's text and a button's
     * label, so writing "" produced a node that failed validation and took its
     * whole enclosing band with it. Models reach for "" constantly here — the
     * editor prompt that preceded this one explicitly trained it as "leave
     * unchanged" — so this has to be handled, not just forbidden.
     */
    if (typeof value === "string" && value.trim() === "") continue;

    if (key === "style") {
      // Merge, don't replace: a patch that sets only `background` must not
      // silently strip the padding the design pass assigned.
      next.style = { ...((node.style ?? {}) as object), ...(value as object) };
      continue;
    }

    if (key === "href") {
      const parsed = linkTargetSchema.safeParse(value);
      if (!parsed.success) continue;
      next.href = parsed.data;
      continue;
    }

    if (key === "src" || key === "videoSrc") {
      /**
       * The church pastes a URL into the chat and the model relays it, so this
       * is untrusted input twice over. `safeMediaUrl` is the same https-only
       * check the render path uses. A rejected value is SKIPPED rather than
       * written as empty: blanking a working photo because someone pasted a
       * bad link is worse than ignoring the request.
       */
      const safe = safeMediaUrl(value);
      if (!safe) continue;
      next[key] = safe;
      continue;
    }

    if (key === "layout") {
      const layouts = COLLECTION_LAYOUTS[node.type];
      if (!layouts || !layouts.has(value as string)) continue;
      next.layout = value;
      continue;
    }

    next[key] = value;
  }

  return next as BlockNode;
}

function walk(
  nodes: BlockNode[],
  byId: Map<string, BlockPatch>,
  protectedIds: ReadonlySet<string>
): BlockNode[] {
  const out: BlockNode[] = [];

  for (const node of nodes) {
    const patch = byId.get(node.id);

    // Restyling or re-wording a nav link is fine; deleting it is not.
    if (patch?.remove && !protectedIds.has(node.id)) continue;

    let next = patch ? applyOne(node, patch) : node;

    if ("children" in next && Array.isArray(next.children)) {
      next = { ...next, children: walk(next.children, byId, protectedIds) } as BlockNode;
    }

    out.push(next);
  }

  return out;
}

/**
 * Applies patches to a tree and re-validates the result.
 *
 * Patches naming an id that isn't in the tree are ignored — a model that
 * invents `hero-subtitle` gets nothing, rather than an error the church has to
 * read. The result still goes through `coerceBlocks`, because a patch is model
 * output like any other, and then through `enforceBlockLegibility` so an edit
 * cannot reintroduce invisible text.
 */
/**
 * One new block, plus where it goes.
 *
 * `block` is a whole subtree, so "add an image gallery section" arrives as one
 * addition rather than a dozen. It is the same recursive `blockNodeSchema` the
 * page composer already sends through OpenAI, so it needs no new
 * structured-output handling — see `toOpenAiJsonSchema` in
 * `lib/ai/agents/specialists.ts`.
 */
export const blockAdditionSchema = z.object({
  /**
   * Insert as the next sibling of this id. Naming a TOP-LEVEL band adds a new
   * band after it; naming a NESTED node adds a sibling inside that node's
   * parent — which is what makes "add a button under the hero heading" work
   * without a separate operation.
   */
  after: z.string().trim().min(1).max(60).optional(),
  /** Used when `after` is absent or names nothing: top of the page, or bottom. */
  at: z.enum(["start", "end"]).optional(),
  block: blockNodeSchema,
});

export type BlockAddition = z.infer<typeof blockAdditionSchema>;

/**
 * Matches a `row`'s column count to how many children actually survived.
 *
 * `repairBlocks` drops a whole node when any field fails — an image whose URL
 * is not https, say — so a three-up gallery can arrive here as a two-child row
 * still declaring `columns: 3`, which renders with a hole in it. Applied only
 * to freshly inserted subtrees: a row already on the page may have been
 * arranged that way on purpose.
 */
function reconcileRowColumns(node: BlockNode): BlockNode {
  if (!("children" in node) || !Array.isArray(node.children)) return node;
  const children = node.children.map(reconcileRowColumns);
  if (node.type !== "row") return { ...node, children } as BlockNode;
  const columns = Math.min(4, Math.max(1, children.length)) as 1 | 2 | 3 | 4;
  return { ...node, columns, children } as BlockNode;
}

/** Collects ids so an inserted subtree can be checked for collisions. */
function subtreeIds(node: BlockNode, into: Set<string>): void {
  into.add(node.id);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) subtreeIds(child, into);
  }
}

/** Re-mints every id in a subtree that would collide with one already on the page. */
function deconflict(node: BlockNode, taken: Set<string>): BlockNode {
  const next = { ...node } as Record<string, unknown>;
  let id = String(next.id ?? "block");
  if (taken.has(id)) {
    let n = 2;
    // `idSchema` caps ids at 60 chars, and an over-long id fails validation —
    // silently dropping the block we were asked to add. Trim the stem so the
    // suffix always fits.
    const suffixed = (i: number) => `${id.slice(0, 60 - String(i).length - 1)}-${i}`;
    while (taken.has(suffixed(n))) n += 1;
    id = suffixed(n);
  }
  taken.add(id);
  next.id = id;
  if (Array.isArray(next.children)) {
    next.children = (next.children as BlockNode[]).map((c) => deconflict(c, taken));
  }
  return next as BlockNode;
}

/**
 * Inserts one block after `after`, at whatever depth that id lives.
 * Returns false when the id was not found, so the caller can fall back.
 */
function insertAfter(
  nodes: BlockNode[],
  afterId: string,
  block: BlockNode,
  protectedIds: ReadonlySet<string>
): BlockNode[] | false {
  // Anchoring inside the nav or footer would put arbitrary content into a band
  // that renders on every page. Refuse, and let the caller fall back.
  if (protectedIds.has(afterId)) return false;

  const index = nodes.findIndex((n) => n.id === afterId);
  if (index !== -1) {
    const next = [...nodes];
    next.splice(index + 1, 0, block);
    return next;
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!("children" in node) || !Array.isArray(node.children)) continue;
    const inner = insertAfter(node.children, afterId, block, protectedIds);
    if (inner === false) continue;
    const next = [...nodes];
    next[i] = { ...node, children: inner } as BlockNode;
    return next;
  }

  return false;
}

/**
 * Keeps `nav` first and `footer` last no matter where a band was inserted.
 *
 * The public layout finds those bands by reserved id, and a model told to add
 * a section "at the start" will cheerfully put one above the navigation.
 */
function pinNavAndFooter(blocks: PageBlocks): PageBlocks {
  const nav = blocks.filter((b) => b.id === NAV_BLOCK_ID);
  const footer = blocks.filter((b) => b.id === FOOTER_BLOCK_ID);
  const rest = blocks.filter((b) => b.id !== NAV_BLOCK_ID && b.id !== FOOTER_BLOCK_ID);
  return [...nav, ...rest, ...footer];
}

/**
 * Gives a newly inserted top-level band a style consistent with its neighbours.
 *
 * `applyDesignPass` is deliberately NOT run here — it re-flows the whole page
 * and would undo edits the church made on purpose. But a band that arrives with
 * no style renders with no background and the renderer's fallback padding,
 * visibly out of step with bands the design pass shaped. This is the narrow
 * version: standard spacing, and a background that differs from both sides.
 */
function styleInsertedBand(blocks: PageBlocks, insertedId: string): PageBlocks {
  return blocks.map((node, index) => {
    if (node.id !== insertedId || node.type !== "section") return node;
    if (node.style?.background && node.style?.padding) return node;

    const neighbours = new Set(
      [blocks[index - 1], blocks[index + 1]]
        .map((n) => n?.style?.background)
        .filter(Boolean) as string[]
    );
    const background =
      (["transparent", "surface", "accent"] as const).find((c) => !neighbours.has(c)) ??
      "transparent";

    return {
      ...node,
      style: { padding: "lg", gap: "md", background, ...(node.style ?? {}) },
    } as BlockNode;
  });
}

/**
 * Reorders the top-level bands to match `order`.
 *
 * Only the bands NAMED in `order` change position, and only among the slots
 * they already occupy — anything the caller left out keeps its exact index.
 * That makes the operation total: a stale client list, an id that has since
 * been deleted, or a partial selection all degrade to a smaller reshuffle
 * rather than dropping a band off the page.
 *
 * Ends in `pinNavAndFooter`, so no client can drag content above the navigation
 * or below the footer even by sending a hand-written order.
 */
export function reorderTopLevel(blocks: PageBlocks, order: readonly string[]): PageBlocks {
  const present = new Set(blocks.map((block) => block.id));
  const seen = new Set<string>();
  const wanted: string[] = [];
  for (const id of order) {
    if (!present.has(id) || seen.has(id) || PROTECTED_IDS.has(id)) continue;
    seen.add(id);
    wanted.push(id);
  }
  if (wanted.length === 0) return blocks;

  const byId = new Map(blocks.map((block) => [block.id, block]));
  const queue = [...wanted];
  const next = blocks.map((block) => {
    if (!seen.has(block.id)) return block;
    /**
     * `queue` holds one entry per DISTINCT id while the map visits every slot,
     * so a tree that somehow carried the same top-level id twice would drain
     * the queue early and splice `undefined` into the page — a crash in
     * `pinNavAndFooter` rather than the degraded reshuffle this function
     * promises. Nothing reachable produces duplicate top-level ids today
     * (`ensureBlockIds` and `deconflict` both mint unique ones); the guard is
     * here because "total" has to mean total.
     */
    const id = queue.shift();
    const replacement = id === undefined ? undefined : byId.get(id);
    return replacement ?? block;
  });

  return pinNavAndFooter(next);
}

export type BlockEdits = {
  patches?: BlockPatch[];
  additions?: BlockAddition[];
};

/**
 * Applies patches and additions to a tree, then re-validates the result.
 *
 * Patches naming an id that isn't in the tree are ignored — a model that
 * invents `hero-subtitle` gets nothing, rather than an error the church has to
 * read. The result still goes through `coerceBlocks`, because model output is
 * model output, and then `enforceBlockLegibility` so an edit cannot
 * reintroduce invisible text.
 */
export function applyBlockEdits(blocks: PageBlocks, edits: BlockEdits): PageBlocks {
  const patches = edits.patches ?? [];
  const additions = edits.additions ?? [];
  if (patches.length === 0 && additions.length === 0) return blocks;

  const byId = new Map<string, BlockPatch>();
  for (const patch of patches) {
    // Last write wins if the model names the same id twice.
    byId.set(patch.id, { ...(byId.get(patch.id) ?? {}), ...patch });
  }

  const protectedIds = protectedSubtreeIds(blocks);
  let next = patches.length > 0 ? walk(blocks, byId, protectedIds) : blocks;

  const taken = new Set<string>();
  for (const node of next) subtreeIds(node, taken);

  const insertedTopLevel: string[] = [];
  for (const addition of additions) {
    // Repaired first: an addition is a whole subtree of model output, and one
    // malformed leaf should cost that leaf, not the section around it.
    const repaired = repairBlocks(ensureBlockIds([addition.block]));
    if (repaired.length === 0) continue;

    const block = deconflict(reconcileRowColumns(repaired[0]), taken);
    const placed = addition.after
      ? insertAfter(next, addition.after, block, protectedIds)
      : false;

    if (placed !== false) {
      next = placed;
    } else if (addition.at === "start") {
      next = [block, ...next];
    } else {
      next = [...next, block];
    }

    if (next.some((n) => n.id === block.id)) insertedTopLevel.push(block.id);
  }

  if (additions.length > 0) {
    next = pinNavAndFooter(next);
    for (const id of insertedTopLevel) next = styleInsertedBand(next, id);
  }

  /**
   * `repairBlocks`, not `coerceBlocks`.
   *
   * `coerceBlocks` drops a whole top-level node when ANY descendant fails
   * validation, which on an edit path means one malformed leaf costs the
   * church an entire band. `repairBlocks` prunes the failing leaf and keeps
   * its siblings — and still caps depth and validates every URL, because it
   * parses with the same `blockNodeSchema`.
   */
  return enforceBlockLegibility(repairBlocks(next));
}

function summarise(node: BlockNode): string {
  const parts: string[] = [node.id, node.type];

  if ("text" in node && node.text) parts.push(JSON.stringify(node.text.slice(0, 90)));
  if ("scale" in node && node.scale) parts.push(`scale=${node.scale}`);
  if ("label" in node && node.label) parts.push(`label=${JSON.stringify(node.label)}`);
  if ("href" in node && node.href) parts.push(`href=${node.href}`);
  if ("layout" in node && node.layout) parts.push(`layout=${node.layout}`);
  if ("columns" in node && node.columns) parts.push(`columns=${node.columns}`);
  if (node.type === "image") parts.push(node.src ? "has-photo" : "empty-photo");

  const style = node.style;
  if (style) {
    const pairs = Object.entries(style)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`);
    if (pairs.length > 0) parts.push(`style{${pairs.join(" ")}}`);
  }

  return parts.join(" | ");
}

/**
 * A flat, indented listing of the tree for the prompt.
 *
 * Cheaper and far more reliable than handing a small model a recursive JSON
 * tree: it only needs to identify the right `id`, and every id it may name is
 * visibly present. Text is truncated because the model is choosing what to
 * change, not reading the page.
 */
export function describeBlocks(blocks: PageBlocks): string {
  const lines: string[] = [];
  const visit = (nodes: BlockNode[], depth: number) => {
    for (const node of nodes) {
      lines.push(`${"  ".repeat(depth)}${summarise(node)}`);
      if ("children" in node && Array.isArray(node.children)) {
        visit(node.children, depth + 1);
      }
    }
  };
  visit(blocks, 0);
  return lines.join("\n");
}
