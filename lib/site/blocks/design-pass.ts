import type {
  BlockNode,
  BlockStyle,
  PageBlocks,
  SpacingToken,
  SurfaceToken,
  TextToneToken,
} from "./types";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID } from "./types";
import { coerceBlocks } from "./schema";

/**
 * Deterministic design rules applied to an AI-composed page.
 *
 * The composer is told to "vary these deliberately band to band", and a small
 * model told that produces a page where half the bands carry no `style` at all
 * and the rest all carry the same one. Rhythm is not something a prompt can be
 * relied on for, and it does not need to be: alternating a background and
 * spacing a band are decisions with a right answer, so they are made here in
 * code where they cannot be un-made by a bad sampling run.
 *
 * Two functions with deliberately different reach:
 *
 * - `enforceBlockLegibility` is the safety net — it only ever removes a
 *   combination that renders as invisible text. It runs on EVERY write,
 *   including a one-line edit from the assistant.
 * - `applyDesignPass` re-flows the whole page's rhythm. It runs only on a full
 *   build, because re-flowing after a targeted edit would fight the user: ask
 *   for a white band, get it, and have the next pass alternate it away again.
 */

/**
 * The band rotation.
 *
 * Every entry is either the page background or a wash of the church's brand at
 * 5-10% — a solid primary/secondary band is never assigned (see
 * `components/website/blocks/tokens.ts`). `inverted` is deliberately absent:
 * it stays available for a composer or an editor prompt that explicitly wants
 * a dark editorial band, but nothing reaches for it on the church's behalf.
 */
const BAND_ROTATION: readonly SurfaceToken[] = [
  "transparent",
  "surface",
  "transparent",
  "accent",
];

/**
 * Tones that are unreadable on a given background.
 *
 * `textToneClass` is applied after `backgroundClass` in the same `cn()`, so a
 * tone always wins over the foreground its background chose — which means
 * `textTone: "accent"` on `background: "accent"` paints the text in nearly the
 * colour behind it. Nothing upstream rejects that.
 *
 * Now that the brand surfaces are 10% washes rather than solid fills, ordinary
 * dark body text reads correctly on all of them — only `inverted` is wrong on
 * a light band, and only the light tones are wrong on a dark one.
 */
const ILLEGIBLE: Record<SurfaceToken, ReadonlySet<TextToneToken>> = {
  transparent: new Set(["inverted"]),
  surface: new Set(["inverted"]),
  primary: new Set(["inverted", "accent"]),
  accent: new Set(["inverted", "accent"]),
  inverted: new Set(["default", "muted"]),
};

function isSection(node: BlockNode): boolean {
  return node.type === "section";
}

function isPinned(node: BlockNode): boolean {
  return node.id === NAV_BLOCK_ID || node.id === FOOTER_BLOCK_ID;
}

function withStyle(node: BlockNode, patch: Partial<BlockStyle>): BlockNode {
  const style = { ...(node.style ?? {}), ...patch };
  return { ...node, style };
}

/**
 * The background a node inherits, for legibility purposes.
 *
 * A leaf's tone is read against the nearest ancestor that actually painted a
 * background, not against its immediate parent — a heading three levels deep
 * inside a `primary` section is still sitting on primary.
 */
function enforceLegibilityIn(
  nodes: BlockNode[],
  inherited: SurfaceToken
): BlockNode[] {
  return nodes.map((node) => {
    const own = node.style?.background;
    const surface: SurfaceToken = own ?? inherited;

    let next = node;
    const tone = node.style?.textTone;
    if (tone && ILLEGIBLE[surface].has(tone)) {
      // Drop the tone rather than substituting one: the background token
      // already resolves a readable foreground on its own.
      const style: BlockStyle = { ...(node.style ?? {}) };
      delete style.textTone;
      const stripped = { ...node } as Record<string, unknown>;
      if (Object.keys(style).length > 0) stripped.style = style;
      else delete stripped.style;
      next = stripped as BlockNode;
    }

    if ("children" in next && Array.isArray(next.children)) {
      return { ...next, children: enforceLegibilityIn(next.children, surface) };
    }
    return next;
  });
}

/**
 * Removes text/background combinations that render as invisible text.
 *
 * Safe to run on any write — it only ever deletes a `textTone`, never invents
 * layout. Called by `applyDesignPass` and after every edit patch.
 */
export function enforceBlockLegibility(blocks: PageBlocks): PageBlocks {
  return enforceLegibilityIn(blocks, "transparent");
}

/**
 * Vertical rhythm: the hero breathes, body bands are consistent, the closing
 * band gets a little more room than a body band so the page ends deliberately.
 */
function paddingForBand(index: number, total: number): SpacingToken {
  if (index === 0) return "2xl";
  if (index === total - 1) return "xl";
  return "lg";
}

/**
 * Alternating backgrounds.
 *
 * Two adjacent bands sharing a background is what makes a page read as one
 * undifferentiated column, so the rotation guarantees a change at every step.
 * The strongest wash available (10% of the brand accent) lands on the closing
 * band, which is the one place a page should push a little.
 */
function backgroundForBand(index: number, total: number): SurfaceToken {
  if (index === 0) return "transparent";
  if (index === total - 1) return "accent";
  return BAND_ROTATION[index % BAND_ROTATION.length];
}

/**
 * Inner spacing for a band's direct children.
 *
 * The renderer's `gap-6` fallback only applies when the model omitted `gap`
 * entirely; a composer that emitted `gap: "none"` produced a hero with its
 * eyebrow, headline, subhead and button touching. Rhythm inside a band is as
 * decidable as rhythm between bands, so it is decided here too — the hero
 * gets the most room because it carries the largest type.
 */
function gapForBand(index: number): SpacingToken {
  return index === 0 ? "lg" : "md";
}

/**
 * Raises a too-tight `gap` on a nested stack.
 *
 * Bands whose children are wrapped in a `stack` route their spacing through
 * `stackGapClass` instead of the band's own gap, so clamping only at band
 * level would miss exactly the hero shape that prompted this.
 */
function relaxNestedGaps(nodes: BlockNode[]): BlockNode[] {
  return nodes.map((node) => {
    let next = node;
    if (node.type === "stack") {
      const gap = node.style?.gap;
      if (gap === "none" || gap === "xs") next = withStyle(node, { gap: "sm" });
    }
    if ("children" in next && Array.isArray(next.children)) {
      return { ...next, children: relaxNestedGaps(next.children) };
    }
    return next;
  });
}

/** True when an `image` block has nothing to show yet. */
function isEmptyImage(node: BlockNode): boolean {
  return node.type === "image" && !node.src && !node.videoSrc;
}

/**
 * Caps empty photo slots.
 *
 * The composer is instructed to always leave `src` empty — photos are the
 * church's to upload — so a fresh build can ship five full-bleed gradient
 * rectangles, which is most of what makes a new site look unfinished. One is a
 * deliberate "your photo goes here"; five is a broken page. Keeps the first
 * and drops the rest, decrementing the parent `row`'s `columns` so the grid
 * doesn't end up with a hole in it.
 */
function capEmptyImages(nodes: BlockNode[], budget: { left: number }): BlockNode[] {
  const out: BlockNode[] = [];

  for (const node of nodes) {
    if (isEmptyImage(node)) {
      if (budget.left <= 0) continue;
      budget.left -= 1;
      out.push(node);
      continue;
    }

    if ("children" in node && Array.isArray(node.children)) {
      const before = node.children.length;
      const children = capEmptyImages(node.children, budget);
      const dropped = before - children.length;

      // A row's column count is a layout promise about how many children it
      // has; dropping one without adjusting it leaves a visible gap.
      if (node.type === "row" && dropped > 0) {
        const columns = Math.max(1, (node.columns ?? 2) - dropped);
        out.push({
          ...node,
          columns: Math.min(4, columns) as 1 | 2 | 3 | 4,
          children,
        });
        continue;
      }

      // An emptied container is worse than no container.
      if (children.length === 0 && before > 0) continue;
      out.push({ ...node, children });
      continue;
    }

    out.push(node);
  }

  return out;
}

export type RequiredBandContext = {
  features?: Record<string, unknown>;
  churchName?: string;
  story?: { mission?: string; values?: string };
  tagline?: string;
};

/** Every block type present anywhere in the tree. */
function collectTypes(nodes: BlockNode[], into: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    into.add(node.type);
    if ("children" in node && Array.isArray(node.children)) collectTypes(node.children, into);
  }
  return into;
}

/** Feature flag -> the data-bound block that band is built around. */
const FEATURE_BLOCK: ReadonlyArray<{ flag: string; type: string; id: string; eyebrow: string }> = [
  { flag: "sermons", type: "sermonCollection", id: "sermons", eyebrow: "Listen again" },
  { flag: "events", type: "eventCollection", id: "events", eyebrow: "What's on" },
  { flag: "giving", type: "givingCta", id: "giving", eyebrow: "Support the work" },
  { flag: "contact", type: "contactInfo", id: "contact", eyebrow: "Visit us" },
];

function band(id: string, children: BlockNode[]): BlockNode {
  return { id, type: "section", children } as BlockNode;
}

/**
 * Guarantees the homepage actually contains the sections the church's nav
 * promises.
 *
 * The composer prompt asks for one band per enabled feature, and a small model
 * routinely ships a page with a hero, a welcome band and nothing else — while
 * the nav still links to /sermons, /events and /giving. A visitor lands on a
 * homepage that mentions none of them.
 *
 * Only bands that need no invented content are synthesized. `sermonCollection`
 * and `eventCollection` render real rows; `givingCta` and `contactInfo` render
 * the church's own details. The about band is built from the church's OWN
 * words (mission, then values, then tagline) and is skipped entirely when they
 * supplied none — an empty homepage section is better than a fabricated claim
 * about a church. `ministryCollection` is never synthesized for the same
 * reason: its copy has no source but the model.
 */
function ensureRequiredBands(blocks: PageBlocks, ctx: RequiredBandContext): PageBlocks {
  const present = collectTypes(blocks);
  const ids = new Set(blocks.map((b) => b.id.toLowerCase()));
  const features = ctx.features ?? {};
  const additions: BlockNode[] = [];

  // About/welcome: narrative, so it can only be built from what the church
  // actually told us during onboarding.
  const hasNarrative = [...ids].some((id) => id.includes("about") || id.includes("welcome"));
  const aboutCopy = ctx.story?.mission?.trim() || ctx.story?.values?.trim() || ctx.tagline?.trim();
  if (!hasNarrative && aboutCopy) {
    additions.push(
      band("about", [
        { id: "about-eyebrow", type: "eyebrow", text: "Who we are" } as BlockNode,
        {
          id: "about-heading",
          type: "heading",
          scale: "h2",
          text: ctx.churchName ? `About ${ctx.churchName}` : "About us",
        } as BlockNode,
        { id: "about-text", type: "text", text: aboutCopy } as BlockNode,
      ])
    );
  }

  for (const entry of FEATURE_BLOCK) {
    if (features[entry.flag] !== true) continue;
    if (present.has(entry.type)) continue;
    additions.push(
      band(entry.id, [
        { id: `${entry.id}-eyebrow`, type: "eyebrow", text: entry.eyebrow } as BlockNode,
        { id: `${entry.id}-body`, type: entry.type } as BlockNode,
      ])
    );
  }

  if (additions.length === 0) return blocks;

  // Injected before the closing band and the footer, so the page still ends on
  // whatever call to action the composer wrote.
  const footerAt = blocks.findIndex((b) => b.id === FOOTER_BLOCK_ID);
  const tailStart = footerAt === -1 ? blocks.length : footerAt;
  const insertAt = tailStart > 1 ? tailStart - 1 : tailStart;

  return [...blocks.slice(0, insertAt), ...additions, ...blocks.slice(insertAt)];
}

/**
 * Alignment variety across bands.
 *
 * A page that is entirely centred reads as a landing page template; one that
 * is entirely left-aligned reads as a document. Only applied when the model
 * committed to neither — an explicit mix is left alone.
 */
function needsAlignmentVariety(bands: BlockNode[]): boolean {
  const aligns = bands.map((band) => band.style?.align ?? "left");
  return new Set(aligns).size === 1 && bands.length >= 4;
}

/**
 * The full rhythm pass. Full builds only — see the module docblock.
 *
 * Nav and footer are pinned bands with their own fixed treatment and are never
 * re-flowed; everything between them is.
 */
export function applyDesignPass(
  blocks: PageBlocks,
  context: RequiredBandContext = {}
): PageBlocks {
  if (blocks.length === 0) return blocks;

  const budget = { left: 1 };
  // Missing bands are added BEFORE rhythm is assigned, so an injected band
  // takes part in the alternation instead of being bolted on afterwards.
  const complete = ensureRequiredBands(capEmptyImages(blocks, budget), context);
  const capped = relaxNestedGaps(complete);

  const bandIndexes: number[] = [];
  capped.forEach((node, index) => {
    if (isSection(node) && !isPinned(node)) bandIndexes.push(index);
  });

  const bands = bandIndexes.map((index) => capped[index]);
  const total = bands.length;
  const varyAlignment = needsAlignmentVariety(bands);

  let previousBackground: SurfaceToken | null = null;
  const restyled = new Map<number, BlockNode>();

  bands.forEach((band, position) => {
    let background = backgroundForBand(position, total);

    // Never two identical backgrounds back to back — the whole point.
    if (background === previousBackground) {
      background = background === "transparent" ? "surface" : "transparent";
    }
    previousBackground = background;

    const patch: Partial<BlockStyle> = {
      padding: paddingForBand(position, total),
      gap: gapForBand(position),
      background,
    };

    if (varyAlignment) {
      // Hero and closing band centred, body bands left — an editorial rhythm
      // rather than one setting repeated down the page.
      patch.align =
        position === 0 || position === total - 1 ? "center" : "left";
    }

    restyled.set(bandIndexes[position], withStyle(band, patch));
  });

  const next = capped.map((node, index) => restyled.get(index) ?? node);

  /**
   * Re-coerced on the way out so the result is canonical: zod emits keys in
   * schema order, while the spreads above append `style` last. Without this
   * the pass is idempotent in meaning but not in bytes, and
   * `scripts/backfill-design-pass.ts` — which decides whether to write by
   * comparing serialized trees — would rewrite every site on every run.
   */
  return coerceBlocks(enforceBlockLegibility(next));
}
