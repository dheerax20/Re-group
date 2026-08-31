import type {
  AlignToken,
  BlockNode,
  BlockStyle,
  ImageAspectToken,
  ImageTreatmentToken,
  PageBlocks,
  SpacingToken,
  SurfaceToken,
  TextToneToken,
  WidthToken,
} from "./types";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID, HERO_BLOCK_ID } from "./types";
import { coerceBlocks } from "./schema";
import {
  buildHeroBand,
  pickHeroImage,
  resolveHeroCopy,
  type HeroCopy,
  type StockImageKind,
} from "./hero";

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
 * How a design template composes the hero band.
 *
 * A discriminated union rather than a bag of optional fields, so an
 * archetype cannot be paired with settings that mean nothing to it — an
 * `overlay` hero has no photo width, a `split` hero has no overlay. The three
 * archetypes are: `overlay` (photograph fills the band, copy over it), `split`
 * (asymmetric columns, photo bleeding to one edge) and `stacked` (centred copy
 * over a tint, widescreen photograph beneath).
 */
export type HeroRecipe =
  | {
      archetype: "overlay";
      image: "overlay";
      overlay: "scrim" | "dark";
      /** `scrim` is the gradient for left-ranged copy; `dark` is flat, for centred. */
      align: "left" | "center";
      copyWidth: WidthToken;
    }
  | {
      archetype: "split";
      image: "vertical";
      /** Which edge the photograph bleeds to. `wide-left` = text first. */
      split: "wide-left" | "wide-right";
    }
  | {
      archetype: "stacked";
      image: "widescreen";
      copyWidth: WidthToken;
      photoWidth: WidthToken;
      treatment: ImageTreatmentToken;
      aspect: ImageAspectToken;
    };

/**
 * What a design template decides, in the vocabulary the block renderer
 * actually implements.
 *
 * Every field here is applied deterministically below, not asked of the model
 * — the same split this module already documents for band rhythm, extended to
 * everything a small model gets wrong the same way every time. Before this
 * existed the pass applied ONE hardcoded rotation, one padding ramp and one
 * centred-hero rule to every church on the platform, which is the real reason
 * regenerating a site produced the same page with different words.
 *
 * The six templates live in `lib/ai/agents/catalog.ts`, which imports this
 * type. The dependency points that way on purpose: a design recipe is a
 * property of the site, and the AI layer picks one — not the reverse.
 */
export type DesignRecipe = {
  /**
   * The band background rotation, replacing a single global constant. Index 0
   * is the hero and the last band takes the rotation's final entry.
   *
   * Every entry should be the page background or a wash of the church's brand
   * at 5-10% — a solid primary/secondary band is never assigned (see
   * `components/website/blocks/tokens.ts`). `inverted` is the one exception: a
   * dark editorial band is a real device, so a template may commit to it, but
   * nothing reaches for it on the church's behalf.
   */
  bandRhythm: SurfaceToken[];
  bandPadding: { hero: SpacingToken; body: SpacingToken; closing: SpacingToken };
  /**
   * How CONTENT bands are ranged — the hero owns its own alignment and is not
   * counted here.
   *
   * `left` ranges the whole page left (a document); `centered-close` ranges the
   * body left and centres only the closing band, so the page ends
   * deliberately; `alternating` flips band to band. A page centred throughout
   * reads as a landing-page template, which is exactly the look this is here
   * to break up.
   */
  alignPolicy: "left" | "centered-close" | "alternating";
  width: WidthToken;
  /** How `buildHeroBand` composes the hero. See `HeroRecipe`. */
  hero: HeroRecipe;
  /**
   * A stock photograph for the welcome/about band, or `null` for none.
   *
   * `overlay` is never valid here — those frames are graded dark and are
   * unreadable without a scrim painted over them, which only the hero has.
   */
  welcomeImage: "vertical" | "widescreen" | null;
  sermons: "grid" | "list" | "featured";
  events: "grid" | "list" | "calendar";
  image: { treatment: ImageTreatmentToken; aspect: ImageAspectToken };
  /**
   * An eyebrow above every heading is a hard ban in the craft floor this
   * renderer is held to — the heading carries its own weight. `none` strips
   * them all; `hero-only` keeps at most the first on the page.
   */
  eyebrows: "none" | "hero-only";
};

/**
 * The recipe used when no template is in play — the legacy `sectionConfig`
 * path and `scripts/backfill-design-pass.ts`. Its rotation and padding ramp
 * are the values this module hardcoded before templates existed.
 *
 * Not a no-op against a pre-template site, though: `align` and `width` are now
 * assigned on every band rather than only when the model had committed to one
 * alignment everywhere, so the backfill script WILL find a diff and rewrite.
 * That is intended — a band whose alignment nobody chose is the failure this
 * replaced — but it means the script is no longer safe to run casually against
 * live sites. Published sites are otherwise untouched: nothing runs the design
 * pass except a full build.
 */
export const DEFAULT_DESIGN_RECIPE: DesignRecipe = {
  bandRhythm: ["transparent", "surface", "transparent", "accent"],
  bandPadding: { hero: "2xl", body: "lg", closing: "xl" },
  alignPolicy: "centered-close",
  width: "wide",
  hero: {
    archetype: "stacked",
    image: "widescreen",
    copyWidth: "normal",
    photoWidth: "normal",
    treatment: "rounded",
    aspect: "wide",
  },
  welcomeImage: null,
  sermons: "grid",
  events: "grid",
  image: { treatment: "rounded", aspect: "video" },
  eyebrows: "hero-only",
};

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

/**
 * The surface a node's text actually sits on.
 *
 * A band carrying a photograph under a `scrim` or `dark` overlay is a DARK
 * surface, whatever its `background` token says — and the hero's whole design
 * is white type over that photograph. Reading only `background` here meant the
 * legibility pass saw `transparent`, decided `textTone: "inverted"` was
 * unreadable, stripped it, and rendered the hero dark-on-dark.
 *
 * `overlay: "none"` is deliberately not dark: with no wash over it a photo can
 * be any brightness, so the safe reading is to leave the inherited surface
 * alone rather than promise contrast the image cannot keep.
 */
function effectiveSurface(node: BlockNode, inherited: SurfaceToken): SurfaceToken {
  const style = node.style;
  if (style?.backgroundImage && (style.overlay === "scrim" || style.overlay === "dark")) {
    return "inverted";
  }
  return style?.background ?? inherited;
}

/** The two chrome bands, whose own builders own their shape. */
function isPinned(node: BlockNode): boolean {
  return node.id === NAV_BLOCK_ID || node.id === FOOTER_BLOCK_ID;
}

/**
 * Bands the rhythm rotation must not touch.
 *
 * Nav, footer and hero are all authored rather than composed, so the
 * `transparent → surface → …` rotation counts CONTENT bands only — which is
 * what it was written for. It has been off by one ever since the nav started
 * being emitted as a top-level section, and adding the hero to the rotation
 * would overwrite the template's photograph, tint and centring with the plain
 * page background.
 */
function isRhythmExempt(node: BlockNode): boolean {
  return isPinned(node) || node.id === HERO_BLOCK_ID;
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
    const surface: SurfaceToken = effectiveSurface(node, inherited);

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
function paddingForBand(index: number, total: number, recipe: DesignRecipe): SpacingToken {
  if (index === 0) return recipe.bandPadding.hero;
  if (index === total - 1) return recipe.bandPadding.closing;
  return recipe.bandPadding.body;
}

/**
 * Alternating backgrounds, from the template's own rotation.
 *
 * Two adjacent bands sharing a background is what makes a page read as one
 * undifferentiated column, so the caller also guarantees a change at every
 * step. The hero always opens on the rotation's first entry and the closing
 * band takes its last, which is the one place a page should push a little.
 */
function backgroundForBand(index: number, total: number, recipe: DesignRecipe): SurfaceToken {
  const rotation = recipe.bandRhythm.length > 0 ? recipe.bandRhythm : DEFAULT_DESIGN_RECIPE.bandRhythm;
  if (index === 0) return rotation[0];
  if (index === total - 1) return rotation[rotation.length - 1];
  return rotation[index % rotation.length];
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
  /**
   * The hero's three strings, from the composer.
   *
   * Its PRESENCE is what gates hero injection. A page built before heroes
   * existed has no copy object, and `scripts/backfill-design-pass.ts` must not
   * graft a hero onto it — a church would find a photograph and a headline
   * they never approved at the top of their live homepage.
   */
  hero?: Partial<HeroCopy>;
  /** Seeds the deterministic stock-photo choice. */
  siteId?: string;
  /** The photo the last build used, so a redesign does not reuse it. */
  previousHeroImage?: string;
};

/** Every block type present anywhere in the tree. */
function collectTypes(nodes: BlockNode[], into: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    into.add(node.type);
    if ("children" in node && Array.isArray(node.children)) collectTypes(node.children, into);
  }
  return into;
}

/**
 * Feature flag -> the data-bound block that band is built around.
 *
 * `heading` rather than the eyebrow these used to carry. An eyebrow is a
 * decorative label above a heading, and a synthesized band has no heading for
 * it to sit above — so every injected band arrived as a small tracked-out
 * caption floating over a list of sermons. A band gets a title; the title is
 * a heading.
 */
const FEATURE_BLOCK: ReadonlyArray<{ flag: string; type: string; id: string; heading: string }> = [
  { flag: "sermons", type: "sermonCollection", id: "sermons", heading: "Recent sermons" },
  { flag: "events", type: "eventCollection", id: "events", heading: "What's coming up" },
  { flag: "giving", type: "givingCta", id: "giving", heading: "Support this church" },
  { flag: "contact", type: "contactInfo", id: "contact", heading: "Visit us" },
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
        {
          id: `${entry.id}-heading`,
          type: "heading",
          scale: "h2",
          text: entry.heading,
        } as BlockNode,
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
 * Band alignment, from the template's policy.
 *
 * A page that is entirely centred reads as a landing page template; one that
 * is entirely left-aligned reads as a document. Which of those a church gets
 * is a decision the template makes, so unlike the old heuristic this is
 * applied whether or not the model happened to commit to an alignment — a
 * model that centred everything was the failure case, not a signal to respect.
 */
function alignForBand(
  position: number,
  total: number,
  recipe: DesignRecipe
): AlignToken {
  switch (recipe.alignPolicy) {
    case "left":
      return "left";
    case "alternating":
      return position % 2 === 0 ? "left" : "center";
    case "centered-close":
    default:
      // Only the last band. Centring the first as well made sense when the
      // first content band WAS the hero; now the hero is built by the template
      // and exempt, so that rule would centre the welcome band for no reason.
      return position === total - 1 ? "center" : "left";
  }
}

/**
 * Normalises the pinned nav and footer bands.
 *
 * These are the two bands the rhythm loop deliberately skips, and skipping
 * them was read as "never touch them at all" — which is how a header shipped
 * with 160px of vertical padding and its links stranded at the container's
 * midpoint. Two independent causes, both fixed here:
 *
 * - The composer must emit `nav` as a top-level `section`, and it was also
 *   told never to set a band's padding below `lg`. `lg` is `py-20`. The
 *   renderer now owns a pinned band's height outright, so the token is
 *   stripped rather than clamped — leaving a value that is ignored downstream
 *   only invites someone to "fix" the renderer to honour it again.
 * - A `row` defaults to an equal-column grid, so a two-child nav put the links
 *   at 50% of the container with a screen's worth of dead space to their
 *   right. A bar is `layout: "bar"`.
 *
 * Deliberately narrow: it does not re-flow the bands' contents, so a composer
 * that put a button or a second link group in the nav keeps it.
 */
function normalizePinnedBands(blocks: PageBlocks): PageBlocks {
  return blocks.map((node) => {
    if (!isPinned(node) || node.type !== "section") return node;

    const style: BlockStyle = { ...(node.style ?? {}) };
    delete style.padding;
    delete style.gap;
    delete style.align;

    const children = node.children.map((child) =>
      child.type === "row" ? { ...child, layout: "bar" as const } : child
    );

    const next = { ...node, children } as Record<string, unknown>;
    if (Object.keys(style).length > 0) next.style = style;
    else delete next.style;
    return next as BlockNode;
  });
}

/**
 * Applies the template's leaf-level choices.
 *
 * Collection layout and image treatment are the two places a design template
 * shows up in a band the model wrote rather than one this file synthesized.
 * Without this a template changes the page's rhythm and its prose but every
 * sermon list still renders as the same card grid, and two directions read as
 * the same site with the paragraphs moved.
 *
 * An `image` that already carries a real `src` keeps its aspect: the church
 * uploaded that photo at a shape someone chose, and re-cropping it to the
 * template's default is a worse picture, not a more consistent page.
 */
function applyRecipeToLeaves(
  nodes: BlockNode[],
  recipe: DesignRecipe,
  /** Top level only: the hero is authored, so nothing below rewrites it. */
  topLevel = true
): BlockNode[] {
  return nodes.map((node) => {
    // The hero's photograph is the template's own choice — `aspect: "fill"`
    // for a bleeding column, a `cinema` crop for a widescreen band — and the
    // band-level image defaults would overwrite both.
    if (topLevel && node.id === HERO_BLOCK_ID) return node;

    let next = node;

    if (node.type === "sermonCollection") {
      next = { ...node, layout: recipe.sermons };
    } else if (node.type === "eventCollection") {
      next = { ...node, layout: recipe.events };
    } else if (node.type === "image") {
      next = {
        ...node,
        treatment: recipe.image.treatment,
        aspect: node.src || node.videoSrc ? node.aspect ?? recipe.image.aspect : recipe.image.aspect,
      };
    }

    if ("children" in next && Array.isArray(next.children)) {
      return { ...next, children: applyRecipeToLeaves(next.children, recipe, false) };
    }
    return next;
  });
}

/**
 * Seeds the welcome/about band with a stock photograph.
 *
 * The hero is no longer the only band that can hold a real picture: a page
 * whose only photo is above the fold still reads as unfinished on the way
 * down. Only ONE band is seeded, and only where the composer already left a
 * photo slot — this fills an empty frame rather than inventing a new one, so a
 * template cannot turn the page into a stock-photo catalogue.
 *
 * `overlay` frames are never used here. They are graded dark for text to sit
 * over, and without a scrim above them they are simply a murky picture.
 */
function seedWelcomeImage(
  blocks: PageBlocks,
  recipe: DesignRecipe,
  ctx: RequiredBandContext
): PageBlocks {
  if (!recipe.welcomeImage) return blocks;

  const target = blocks.findIndex(
    (node) =>
      node.id !== HERO_BLOCK_ID &&
      (node.id.toLowerCase().includes("welcome") || node.id.toLowerCase().includes("about"))
  );
  if (target === -1) return blocks;

  let filled = false;
  const fill = (nodes: BlockNode[]): BlockNode[] =>
    nodes.map((node) => {
      if (!filled && node.type === "image" && !node.src && !node.videoSrc) {
        filled = true;
        return {
          ...node,
          src: pickHeroImage(recipe.welcomeImage as StockImageKind, ctx.siteId ?? "site"),
        };
      }
      if ("children" in node && Array.isArray(node.children)) {
        return { ...node, children: fill(node.children) };
      }
      return node;
    });

  const band = blocks[target];
  if (!("children" in band) || !Array.isArray(band.children)) return blocks;
  const next = { ...band, children: fill(band.children) };
  if (!filled) return blocks;

  return blocks.map((node, index) => (index === target ? next : node));
}

/**
 * Caps eyebrows.
 *
 * A small label above every single heading is the most reliable tell that a
 * page was assembled rather than designed — the craft floor treats it as a
 * hard ban rather than a default, on the grounds that the heading carries its
 * own weight. The block type stays in the vocabulary (existing stored sites
 * use it, and one eyebrow on a hero is a legitimate device), but a template
 * decides how many survive: `hero-only` keeps the first on the page, `none`
 * keeps none.
 *
 * Pinned bands are exempt — a nav has no eyebrows, and walking them would only
 * risk disturbing a bar this pass has already normalised.
 */
function capEyebrows(blocks: PageBlocks, recipe: DesignRecipe): PageBlocks {
  const budget = { left: recipe.eyebrows === "hero-only" ? 1 : 0 };

  const strip = (nodes: BlockNode[]): BlockNode[] => {
    const out: BlockNode[] = [];
    for (const node of nodes) {
      if (node.type === "eyebrow") {
        if (budget.left <= 0) continue;
        budget.left -= 1;
        out.push(node);
        continue;
      }
      if ("children" in node && Array.isArray(node.children)) {
        const children = strip(node.children);
        // An emptied container is worse than no container — same rule
        // `capEmptyImages` follows.
        if (children.length === 0 && node.children.length > 0) continue;
        out.push({ ...node, children });
        continue;
      }
      out.push(node);
    }
    return out;
  };

  // The authored bands are exempt: a nav has no eyebrows, and the hero's copy
  // is the template's, so walking either only risks disturbing a shape this
  // pass did not build.
  return blocks.map((node) =>
    isRhythmExempt(node) || !("children" in node) || !Array.isArray(node.children)
      ? node
      : { ...node, children: strip(node.children) }
  );
}

/**
 * Replaces the hero with one the design template built.
 *
 * The composer is told not to emit a hero at all, so the strip is belt and
 * braces — but a model that ignores that instruction would otherwise leave two
 * bands claiming `id: "hero"`, and the second would be unreachable.
 *
 * Gated on `context.hero`: without a copy object there is nothing true to put
 * in a headline, and inventing one is worse than the page having no hero. That
 * gate is also what keeps `scripts/backfill-design-pass.ts` from grafting a
 * hero onto every site built before this existed.
 */
function injectHero(blocks: PageBlocks, ctx: RequiredBandContext, recipe: DesignRecipe): PageBlocks {
  if (!ctx.hero) return blocks;

  const withoutHero = blocks.filter((node) => node.id !== HERO_BLOCK_ID);
  const copy = resolveHeroCopy(ctx.hero, {
    churchName: ctx.churchName ?? "",
    tagline: ctx.tagline,
    story: ctx.story,
    hasContactPage: ctx.features?.contact === true,
  });
  // `siteId` only seeds which of three photographs this church gets; an absent
  // one still has to produce a picture, so it degrades to a constant rather
  // than skipping the hero.
  const hero = buildHeroBand(recipe.hero, copy, ctx.siteId ?? "site", ctx.previousHeroImage);

  const navAt = withoutHero.findIndex((node) => node.id === NAV_BLOCK_ID);
  const insertAt = navAt === -1 ? 0 : navAt + 1;
  return [...withoutHero.slice(0, insertAt), hero, ...withoutHero.slice(insertAt)];
}

/**
 * Keeps one `display` heading on the page.
 *
 * `display` is the hero headline's scale, and the hero is always the first
 * band — so a second one further down competes with it for the page's single
 * loudest voice. Later ones step down to `h2`, which is what a band title
 * should have been.
 */
function capDisplayHeadings(nodes: BlockNode[], budget = { left: 1 }): BlockNode[] {
  return nodes.map((node) => {
    let next = node;
    if (node.type === "heading" && node.scale === "display") {
      if (budget.left > 0) budget.left -= 1;
      else next = { ...node, scale: "h2" };
    }
    if ("children" in next && Array.isArray(next.children)) {
      return { ...next, children: capDisplayHeadings(next.children, budget) };
    }
    return next;
  });
}

/**
 * The full rhythm pass. Full builds only — see the module docblock.
 *
 * Nav, hero and footer are authored bands with their own fixed treatment and
 * are never re-flowed; everything between them is.
 */
export function applyDesignPass(
  blocks: PageBlocks,
  context: RequiredBandContext = {},
  recipe: DesignRecipe = DEFAULT_DESIGN_RECIPE
): PageBlocks {
  if (blocks.length === 0) return blocks;

  const budget = { left: 1 };
  // Missing bands are added BEFORE rhythm is assigned, so an injected band
  // takes part in the alternation instead of being bolted on afterwards. The
  // hero goes in first of all, so `capEmptyImages` counts against a page that
  // already has its photograph and `capDisplayHeadings` sees the hero headline
  // before any band title.
  const withHero = injectHero(blocks, context, recipe);
  const complete = ensureRequiredBands(capEmptyImages(withHero, budget), context);
  const capped = capDisplayHeadings(
    seedWelcomeImage(
      applyRecipeToLeaves(
        capEyebrows(normalizePinnedBands(relaxNestedGaps(complete)), recipe),
        recipe
      ),
      recipe,
      context
    )
  );

  const bandIndexes: number[] = [];
  capped.forEach((node, index) => {
    if (isSection(node) && !isRhythmExempt(node)) bandIndexes.push(index);
  });

  const bands = bandIndexes.map((index) => capped[index]);
  const total = bands.length;

  let previousBackground: SurfaceToken | null = null;
  /**
   * A dark band is a device, and a device used twice is a pattern. A rotation
   * containing `inverted` hits it again every time the cycle comes round, so a
   * nine-band page gave the "one dark band carries the page" direction two of
   * them. The first one keeps its weight; later hits fall back to the wash.
   */
  let invertedUsed = false;
  const restyled = new Map<number, BlockNode>();

  bands.forEach((band, position) => {
    let background = backgroundForBand(position, total, recipe);

    if (background === "inverted") {
      if (invertedUsed) background = "surface";
      else invertedUsed = true;
    }

    // Never two identical backgrounds back to back — the whole point.
    if (background === previousBackground) {
      background = background === "transparent" ? "surface" : "transparent";
    }
    previousBackground = background;

    const patch: Partial<BlockStyle> = {
      padding: paddingForBand(position, total, recipe),
      gap: gapForBand(position),
      background,
      align: alignForBand(position, total, recipe),
      width: recipe.width,
    };

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
