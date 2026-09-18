import type {
  BlockNode,
  FontFamilyToken,
  ImageAspectToken,
  SpacingToken,
  TextToneToken,
  WidthToken,
} from "./types";
import { HERO_BLOCK_ID } from "./types";
import type { GalleryLayout, HeroRecipe } from "./design-pass";

/**
 * The hero band, built by the design template rather than composed by the model.
 *
 * Three things the block vocabulary could not express made this necessary. The
 * model had no way to say "text over a photograph" — `section`/`stack`/`row`
 * all stack in flow — so a direction briefed for "headlines over deep gradient
 * overlays" silently produced an image sitting *next to* a headline. Band
 * rhythm then overwrote whatever it did produce with the plain page background
 * and 144px of dead space. And there was no photograph at all: a brand-new
 * church's homepage rendered a waiting gradient where the hero should be.
 *
 * So the model now writes three strings and the template builds the band. That
 * is the same division of labour the rest of the design pass already follows —
 * the model decides what is true about this church, the code decides what the
 * page looks like.
 */

/**
 * Stock photography seeded into generated heroes so a brand-new church's
 * homepage has a real photograph on build one. The church replaces these with
 * their own photos later; `isStockImage()` is how the upload flow finds them.
 *
 * Grouped by the composition each set is shot for — do not use a set outside
 * its archetype. A widescreen frame in a vertical split column crops to
 * nothing, and an `overlay` frame is graded dark, so it is unreadable anywhere
 * a scrim is not painted over it.
 */
export const STOCK_HERO_IMAGES = {
  /** Archetype A. Already graded dark; text sits over these. */
  overlay: [
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdmUpbJyeNaERFODnp1fvZeTdqkBlj9ShcKuVy",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdwUL5MDMNXpDU5CsqlxaLwYN3zc0uGrgd1P9j",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdCXZWqGiB0zfeY6Z1HtQ7s5ySIc3juN9mRFrG",
  ],
  /** Archetype B. Portrait crop for the bleeding column. */
  vertical: [
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdSCqykluEMvVfLaoH9pNl3TRwcOWtPIB7GeFy",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdz2EjkIyWLURp8TQO643wPv5ImME9fhisZoxS",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdgnVZM46Px3HUNip9CbFlzRIYaGmwQyOtTE7K",
  ],
  /** Archetype C. Widescreen frame for the band beneath the copy. */
  widescreen: [
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdUl5bEQ8T3RvmNSgqyoFWsfx1ujzI8cJZPBrT",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdWEdyJ7w0e0LsFJ3Gpkji8ug41NmqTfY65MPC",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdG56WJzpOiRa1UqfewFj4zK0JYX7IcDNVkAno",
  ],
  /**
   * Archetype D. High-key frames shot up into the sky, for DARK copy under a
   * white veil — the exact inverse of `overlay`, which is graded dark so white
   * type can sit on it. These are near-white across the top with the subject
   * low in the frame, so a headline lands on empty sky and the architecture
   * reads underneath it rather than behind it.
   *
   * Never pair this set with a `scrim` or `dark` overlay: black over a
   * near-white photograph is a grey rectangle, and the frame's whole value is
   * the empty space at the top.
   */
  light: [
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdRpvTt0cVFbga0pQmlCjsM7y4LdYexT5ENDqG",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdGURcWFpOiRa1UqfewFj4zK0JYX7IcDNVkAno",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdMGfKvGUTcexSsyb52UHIzW7AtofPhQVkFRiu",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdRghoB5cVFbga0pQmlCjsM7y4LdYexT5ENDqG",
  ],
  /**
   * Square-ish frames, for grid cells.
   *
   * The other four sets each answer "what does this church's ONE photograph
   * look like". This one exists because a gallery needs several frames that
   * tile — a set shot for a 21:9 hero crops to nothing in a 1:1 cell. It is
   * also the only set a band can reach for more than one picture at a time.
   */
  square: [
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdVfrJvI1tjQqHoDnOp0aREegTBz758klciu3b",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdx8q3XD7apT681RqmCDjkGsMrozVf9Lw20d3x",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDd1JQw5mKiZer0AXnsPLYt96UGygTDmvh58dfu",
    "https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdMhnQ83UTcexSsyb52UHIzW7AtofPhQVkFRiu",
  ],
} as const;

export type StockImageKind = keyof typeof STOCK_HERO_IMAGES;

/**
 * The aspect box each stock set was actually shot for.
 *
 * A widescreen frame in a 4/5 portrait box is not a crop decision, it is a
 * mistake: `object-cover` takes both edges off the room, and the box is 1.25×
 * its own width tall where the photograph is 0.75×. Declared beside the sets
 * rather than in each recipe, so a direction cannot pair a set with a box it
 * was never shot for — four of the six used to.
 *
 * `overlay` never reaches a content band (it is the hero's own background
 * image, painted by archetype A) but it is listed so the record is total, and
 * so `Record<StockImageKind, …>` keeps demanding an entry for every new set.
 */
export const STOCK_IMAGE_ASPECT: Record<StockImageKind, ImageAspectToken> = {
  overlay: "cinema",
  vertical: "portrait",
  widescreen: "wide",
  /** Like `overlay`, only ever a band's `backgroundImage` — listed for the record. */
  light: "cinema",
  square: "square",
};

export function isStockImage(src: string | undefined): boolean {
  if (!src) return false;
  return Object.values(STOCK_HERO_IMAGES).some((set) =>
    (set as readonly string[]).includes(src)
  );
}

/**
 * Deterministic per site, so a rebuild that keeps the same direction keeps the
 * same photograph and the church does not see the picture change under them
 * for no reason.
 *
 * `avoid` is the previously used URL — passed when the direction changed, so a
 * regeneration reads as a new design rather than the same photo in a new frame.
 */
export function pickHeroImage(
  kind: StockImageKind,
  siteId: string,
  avoid?: string
): string {
  return pickStockImages(kind, siteId, 1, avoid)[0];
}

/**
 * `count` distinct frames from one set, deterministic per site.
 *
 * Walks the set from the site's own hash rather than picking each frame
 * independently, so a gallery never repeats a photograph inside itself and the
 * same church keeps the same arrangement across rebuilds — the guarantee
 * `pickHeroImage` gives for one picture, extended to a group. Three copies of
 * the same steeple is worse than one photograph.
 *
 * A `count` larger than the pool cycles rather than throwing. Three of the five
 * sets hold three frames, so a four-cell grid drawn from one of them WILL
 * repeat; prefer `square` (four) for grids of four, or mix sets per cell.
 *
 * `pickHeroImage` is `pickStockImages(kind, siteId, 1, avoid)[0]`, which is the
 * identical value it returned before this existed — `options[hash % len]` and
 * `options[(hash + 0) % len]` are the same index, so no church's photograph
 * moved when the hash was factored out.
 */
export function pickStockImages(
  kind: StockImageKind,
  siteId: string,
  count: number,
  avoid?: string
): string[] {
  const set = STOCK_HERO_IMAGES[kind] as readonly string[];
  const pool = set.filter((url) => url !== avoid);
  const options = pool.length > 0 ? pool : set;
  let hash = 0;
  for (let i = 0; i < siteId.length; i += 1) {
    hash = (hash * 31 + siteId.charCodeAt(i)) >>> 0;
  }
  return Array.from({ length: count }, (_, i) => options[(hash + i) % options.length]);
}

/** The three strings the composer writes for the hero, and where its button goes. */
export type HeroCopy = {
  headline: string;
  subhead: string;
  ctaLabel: string;
  ctaHref: "/about" | "/contact" | "/events";
};

/** What the church already told us, for the slots the model left empty. */
export type HeroFallbackContext = {
  churchName: string;
  tagline?: string;
  story?: { mission?: string; values?: string };
  hasContactPage?: boolean;
};

/** The first sentence of a paragraph, for a subhead that must not run long. */
export function firstSentence(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : trimmed).slice(0, 160).trim();
}

/**
 * Fills the slots the model left empty, from the church's own words.
 *
 * `subhead` is deliberately allowed to come back empty: an omitted subhead has
 * to shrink the stack rather than leave a gap, so the caller drops the node
 * entirely. An empty string would render an empty paragraph at the hero's
 * gap — which is the failure this avoids.
 */
export function resolveHeroCopy(
  copy: Partial<HeroCopy> | undefined,
  ctx: HeroFallbackContext
): HeroCopy {
  const headline = copy?.headline?.trim() || ctx.tagline?.trim() || ctx.churchName;
  const subhead =
    copy?.subhead?.trim() ||
    firstSentence(ctx.story?.mission) ||
    firstSentence(ctx.story?.values) ||
    "";

  const href = copy?.ctaHref;
  const ctaHref: HeroCopy["ctaHref"] =
    href === "/about" || href === "/contact" || href === "/events"
      ? href
      : ctx.hasContactPage
        ? "/contact"
        : "/about";

  return {
    headline,
    subhead,
    ctaLabel: copy?.ctaLabel?.trim() || "Plan your visit",
    ctaHref,
  };
}

/**
 * One gallery cell.
 *
 * Square corners and no radius — the grid's gutters do the separating, and a
 * radius on every cell turns a set of glimpses into a row of stickers.
 *
 * No `maxHeight`, so every cell takes the `content` ceiling. This is the case
 * that settled why that ceiling is its own token rather than keyed off
 * `priority`: cell zero is both the page's largest contentful paint AND wants
 * the shorter ceiling, because four cells at the hero's 70svh is a contact
 * sheet rather than a hero.
 */
function cell(id: string, src: string, aspect: ImageAspectToken, priority = false): BlockNode {
  return { id, type: "image", src, alt: "", aspect, treatment: "square", priority } as BlockNode;
}

/**
 * The grid, as blocks.
 *
 * Every arrangement is a `stack` of full-width rows, so the gutters come from
 * one `gap` token rather than per-cell margins — and so a narrow viewport
 * collapses each `row` to a single column on its own (`rowColumnsClass` always
 * has a `grid-cols-1` base). A gallery on a phone is a vertical run of
 * photographs, which is the right answer and needs no separate mobile case.
 *
 * `priority` on the first cell only: it is the one frame inside the first
 * viewport, and a block tree cannot tell the renderer which band it is in.
 */
function galleryBlock(layout: GalleryLayout, siteId: string, avoid?: string): BlockNode {
  const row = (id: string, columns: 2 | 3, children: BlockNode[]): BlockNode =>
    ({ id, type: "row", columns, style: { gap: "sm" }, children }) as BlockNode;

  const children: BlockNode[] = (() => {
    switch (layout) {
      case "pair-feature": {
        const pair = pickStockImages("vertical", siteId, 2);
        const [feature] = pickStockImages("widescreen", siteId, 1, avoid);
        return [
          row("gallery-pair", 2, [
            cell("gallery-a", pair[0], "portrait", true),
            cell("gallery-b", pair[1], "portrait"),
          ]),
          cell("gallery-c", feature, "video"),
        ];
      }
      case "triptych": {
        const three = pickStockImages("square", siteId, 3);
        return [
          row(
            "gallery-row",
            3,
            three.map((src, i) => cell(`gallery-${i}`, src, "square", i === 0))
          ),
        ];
      }
      case "duo": {
        const two = pickStockImages("widescreen", siteId, 2, avoid);
        return two.map((src, i) => cell(`gallery-${i}`, src, "video", i === 0));
      }
      case "quad": {
        const four = pickStockImages("square", siteId, 4);
        return [
          row("gallery-top", 2, [
            cell("gallery-a", four[0], "square", true),
            cell("gallery-b", four[1], "square"),
          ]),
          row("gallery-bottom", 2, [
            cell("gallery-c", four[2], "square"),
            cell("gallery-d", four[3], "square"),
          ]),
        ];
      }
      case "feature-pair":
      default: {
        const [feature] = pickStockImages("widescreen", siteId, 1, avoid);
        const pair = pickStockImages("vertical", siteId, 2);
        return [
          cell("gallery-a", feature, "video", true),
          row("gallery-pair", 2, [
            cell("gallery-b", pair[0], "portrait"),
            cell("gallery-c", pair[1], "portrait"),
          ]),
        ];
      }
    }
  })();

  return { id: "hero-gallery", type: "stack", style: { gap: "sm" }, children } as BlockNode;
}

/**
 * The headline and, when there is one, the subhead.
 *
 * Factored out of `copyStack` because the `card` archetype needs these two on
 * their own: its call to action sits on the opposite side of the frame, so a
 * primitive that stacks the button under the subhead is the wrong shape. The
 * subhead's `weight`, `font` and tone logic is the detail most likely to drift
 * if it existed in two places, which is why this is an extraction rather than a
 * second copy.
 */
function copyLines(
  copy: HeroCopy,
  opts: { inverted?: boolean; subheadTone?: TextToneToken }
): BlockNode[] {
  const lines: BlockNode[] = [
    { id: "hero-headline", type: "heading", scale: "display", text: copy.headline },
  ];

  if (copy.subhead) {
    lines.push({
      id: "hero-subhead",
      type: "heading",
      scale: "h3",
      weight: "regular",
      font: "secondary",
      text: copy.subhead,
      /**
       * Accent on a light ground, plain inverted over a photograph. The
       * references show a terracotta subhead on cream but a WHITE one over the
       * scrim — an accent colour that reads beautifully on paper can fall
       * under the contrast floor once it is sitting on a photograph.
       */
      style: { textTone: opts.subheadTone ?? (opts.inverted ? "inverted" : "accent") },
    } as BlockNode);
  }

  return lines;
}

/**
 * The copy stack, shared by every archetype that keeps its button in the column.
 *
 * Every reference pairs a sans headline with a SERIF subhead, and that
 * pairing is the single detail that most separates them from a default stack
 * of bold-heading-over-grey-paragraph. It takes an explicit
 * `font: "secondary"`: `app/globals.css` pins every heading inside
 * `.theme-root` to `font-family: inherit`, i.e. the primary face, so a
 * `heading` does NOT pick up the church's second face on its own.
 *
 * `weight: "regular"` keeps the subhead from competing with the headline, and
 * `textTone` gives it the church's accent on a light ground. Typography stays
 * out of the model's hands at every layer — it writes the words, the template
 * sets them.
 */
function copyStack(
  copy: HeroCopy,
  opts: {
    align: "left" | "center";
    width?: WidthToken;
    inverted?: boolean;
    padding?: SpacingToken;
    /**
     * The subhead's colour. `accent` on a light ground and `inverted` over a
     * dark photograph are what the first three archetypes use; `veil` takes
     * `muted`, because an accent line over a pale photograph falls under the
     * contrast floor.
     */
    subheadTone?: TextToneToken;
    /**
     * The CTA label's face. Defaults to the SECOND face, which is what stops
     * the button reading as a form control dropped onto a designed page —
     * except under `veil`, whose reference matches the button to its serif
     * headline instead and lets the sans subhead be the only thing between them.
     */
    ctaFont?: FontFamilyToken;
  }
): BlockNode {
  const children: BlockNode[] = copyLines(copy, opts);

  /**
   * The reference puts ~48px between the subhead and the button where the rest
   * of the stack sits at 24px. A stack has one uniform gap, so the extra space
   * is a spacer rather than a second gap token.
   */
  children.push({ id: "hero-cta-space", type: "spacer", size: "sm" } as BlockNode);
  // The references set the button label in the second face too, which is what
  // stops the CTA reading as a form control dropped onto a designed page.
  children.push({
    id: "hero-cta",
    type: "button",
    label: copy.ctaLabel,
    href: copy.ctaHref,
    emphasis: "primary",
    font: opts.ctaFont ?? "secondary",
  } as BlockNode);

  return {
    id: "hero-copy",
    type: "stack",
    style: {
      gap: "md",
      align: opts.align,
      ...(opts.width ? { width: opts.width } : {}),
      ...(opts.inverted ? { textTone: "inverted" as const } : {}),
      ...(opts.padding ? { padding: opts.padding } : {}),
    },
    children,
  } as BlockNode;
}

/**
 * Builds the hero band for a design template.
 *
 * `siteId` seeds the photo choice; `previousImage` is what the last build used,
 * so a regeneration on a new direction does not reuse the same picture.
 */
export function buildHeroBand(
  recipe: HeroRecipe,
  copy: HeroCopy,
  siteId: string,
  previousImage?: string
): BlockNode {
  const photo = pickHeroImage(recipe.image, siteId, previousImage);

  if (recipe.archetype === "overlay") {
    /**
     * Archetype A — the photograph fills the band and the copy sits over it.
     *
     * `width: "full"` puts the copy at the page gutter and nothing else, which
     * is what lands the headline's left edge on the same axis as the nav logo
     * above it. `minHeight: "hero"` also centres the copy vertically, so it
     * sits on the optical centre line rather than pinned to the top.
     */
    return {
      id: HERO_BLOCK_ID,
      type: "section",
      style: {
        backgroundImage: photo,
        overlay: recipe.overlay,
        background: "inverted",
        minHeight: "hero",
        padding: "2xl",
        width: "full",
        align: recipe.align,
      },
      children: [
        // No `width`: the section already sits at the page gutter, which is
        // the axis the nav logo is on, and a second gutter would push the
        // headline off it. The measure comes from the display scale itself.
        copyStack(copy, { align: recipe.align, inverted: true }),
      ],
    } as BlockNode;
  }

  if (recipe.archetype === "gallery") {
    /**
     * Archetype F — copy on one side, a grid of photographs on the other.
     *
     * `rowLayoutClass["wide-left"]` carries no `items-*` (unlike `columns`),
     * which is correct for the `split` archetype whose `fill` photograph must
     * stretch to the row's height. Here it means the copy column is stretched
     * by the taller gallery beside it and pins its content to the top of that
     * cell. `verticalAlign` on the stack is what centres it against the grid.
     */
    const copyColumn = {
      id: "hero-copy-column",
      type: "stack",
      style: { gap: "md", align: "left", verticalAlign: "center" },
      children: [copyStack(copy, { align: "left" })],
    } as BlockNode;

    return {
      id: HERO_BLOCK_ID,
      type: "section",
      style: {
        background: "transparent",
        minHeight: "hero",
        padding: "xl",
        width: "full",
        align: "left",
      },
      children: [
        {
          id: "hero-row",
          type: "row",
          layout: recipe.split,
          style: { gap: "xl" },
          /**
           * DOM order is always copy-then-gallery. `wide-right` mirrors with
           * CSS `order` inside `rowLayoutClass`, so a phone visitor meets the
           * words before three photographs either way — the same rule the
           * `split` archetype already follows.
           */
          children: [copyColumn, galleryBlock(recipe.grid, siteId, previousImage)],
        } as BlockNode,
      ],
    } as BlockNode;
  }

  if (recipe.archetype === "card") {
    /**
     * Archetype E — the photograph as an inset card.
     *
     * Shares archetype A's dark frames and white type, and differs in how the
     * frame is held: inset from all four viewport edges with rounded corners,
     * so the page shows around it and the navigation has somewhere to sit above
     * it rather than over it.
     *
     * `width: "full"`, not `bleed`: the frame carries the page gutter so the
     * copy sits in from its rounded corner rather than on the curve.
     */
    return {
      id: HERO_BLOCK_ID,
      type: "section",
      style: {
        backgroundImage: photo,
        overlay: recipe.overlay,
        background: "inverted",
        minHeight: "hero",
        padding: "2xl",
        width: "full",
        align: "left",
        inset: recipe.inset,
        radius: recipe.radius,
        verticalAlign: recipe.verticalAlign,
      },
      children: [
        {
          id: "hero-bar",
          type: "row",
          // Aligned on a shared bottom edge, so the button sits level with the
          // subhead rather than floating level with the headline.
          layout: "bar-end",
          style: { gap: "lg" },
          children: [
            {
              id: "hero-copy",
              type: "stack",
              style: { gap: "sm", align: "left", textTone: "inverted" },
              children: copyLines(copy, { inverted: true }),
            } as BlockNode,
            {
              id: "hero-cta",
              type: "button",
              label: copy.ctaLabel,
              href: copy.ctaHref,
              emphasis: "primary",
              font: "secondary",
              // The pill — the one place the radius token is doing design work
              // rather than plumbing.
              style: { radius: "full" },
            } as BlockNode,
          ],
        } as BlockNode,
      ],
    } as BlockNode;
  }

  if (recipe.archetype === "veil") {
    /**
     * Archetype D — dark copy over a high-key photograph.
     *
     * `background: "transparent"`, NOT `"inverted"`. `effectiveSurface()` reads
     * a background image as a dark surface only under a `scrim` or `dark`
     * overlay, so this band stays light for `enforceBlockLegibility` — which is
     * exactly right, because the copy here is the page's ordinary dark
     * foreground. Setting `inverted` would make the legibility pass strip every
     * dark tone in the stack and render the headline white on white.
     *
     * `minHeight: "screen"`, not `"hero"`: this frame is the whole first screen
     * in the reference.
     */
    return {
      id: HERO_BLOCK_ID,
      type: "section",
      style: {
        backgroundImage: photo,
        overlay: "veil",
        background: "transparent",
        minHeight: "screen",
        padding: "2xl",
        width: "full",
        align: recipe.align,
      },
      children: [
        copyStack(copy, {
          align: recipe.align,
          width: recipe.copyWidth,
          // Grey, not accent: an accent line over a pale photograph is the one
          // place that colour falls under the contrast floor.
          subheadTone: "muted",
          // The button matches the HEADLINE's face here, not the subhead's.
          ctaFont: "primary",
        }),
        /**
         * The band centres its children vertically (`minHeight` !== "none"),
         * and every frame in the `light` set puts its subject in the LOWER
         * half. A spacer under the copy lifts the stack above the optical
         * centre so the headline sits on empty sky instead of across a
         * roofline. A spacer rather than a `justify` token because the renderer
         * owns that decision for every band with a floor, and one band is not a
         * reason to widen `BlockStyle`.
         */
        { id: "hero-floor", type: "spacer", size: "2xl" } as BlockNode,
      ],
    } as BlockNode;
  }

  if (recipe.archetype === "split") {
    /**
     * Archetype B — text against a tint, photograph bleeding to one edge.
     *
     * No negative margins: the section is `width: "full"` with `padding:
     * "none"`, so the grid reaches both viewport edges on its own and the text
     * column carries the padding. The band floor stops a short headline
     * collapsing the photograph into a strip.
     *
     * DOM order is always copy-then-photo, for both variants. Below `lg` the
     * grid is one column, and a phone visitor must not meet a full-height
     * photograph before any words — so `wide-right` mirrors with CSS `order`
     * inside `rowLayoutClass`, never by reordering the children here.
     */
    const text = copyStack(copy, { align: "left", padding: "2xl", width: "full" });
    const image = {
      id: "hero-photo",
      type: "image",
      src: photo,
      alt: "",
      aspect: "fill",
      treatment: "square",
    } as BlockNode;

    return {
      id: HERO_BLOCK_ID,
      type: "section",
      // `bleed`, not `full`: the photograph has to reach the viewport edge,
      // and it cannot do that through a band that carries the gutter itself.
      // The text column carries it instead — see `copyStack` below.
      style: { background: "surface", padding: "none", width: "bleed", minHeight: "hero" },
      children: [
        {
          id: "hero-row",
          type: "row",
          layout: recipe.split,
          style: { gap: "none" },
          children: [text, image],
        } as BlockNode,
      ],
    } as BlockNode;
  }

  /** Archetype C — centred copy over a tint, widescreen photograph beneath. */
  return {
    id: HERO_BLOCK_ID,
    type: "section",
    style: { background: "surface", padding: "2xl", align: "center", width: "bleed" },
    children: [
      copyStack(copy, { align: "center", width: recipe.copyWidth }),
      { id: "hero-photo-space", type: "spacer", size: "xl" } as BlockNode,
      {
        id: "hero-photo",
        type: "image",
        src: photo,
        alt: "",
        aspect: recipe.aspect,
        treatment: recipe.treatment,
        priority: true,
        /**
         * The only image on the page that gets the taller ceiling. This IS the
         * first screen, so a crop to 52svh would take the top off the frame the
         * whole archetype is built around. Set beside `priority` but meaning
         * something different — see `MaxHeightToken`.
         */
        maxHeight: "hero",
        style: { width: recipe.photoWidth },
      } as BlockNode,
    ],
  } as BlockNode;
}

/**
 * The photograph a built page ended up with.
 *
 * Stored as `storyConfig.heroImageUrl` so the NEXT build — or the next
 * template applied — can pass it as `avoid` and pick a different frame. Lives
 * here rather than beside either caller because both the AI crew and the
 * template apply path need it and neither owns it.
 *
 * Checks the band's own background first (archetype A paints the photo there),
 * then walks for the first `image` node (B and C hold it as a child).
 */
export function heroImageIn(blocks: BlockNode[] | undefined): string | undefined {
  const hero = blocks?.find((node) => node.id === HERO_BLOCK_ID);
  if (!hero) return undefined;
  if (hero.style?.backgroundImage) return hero.style.backgroundImage;

  const findImage = (nodes: BlockNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.type === "image" && node.src) return node.src;
      if ("children" in node && Array.isArray(node.children)) {
        const found = findImage(node.children);
        if (found) return found;
      }
    }
    return undefined;
  };

  return "children" in hero && Array.isArray(hero.children)
    ? findImage(hero.children)
    : undefined;
}
