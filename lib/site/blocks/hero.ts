import type { BlockNode } from "./types";
import { HERO_BLOCK_ID } from "./types";
import type { HeroRecipe } from "./design-pass";

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
} as const;

export type StockImageKind = keyof typeof STOCK_HERO_IMAGES;

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
  const set = STOCK_HERO_IMAGES[kind] as readonly string[];
  const pool = set.filter((url) => url !== avoid);
  const options = pool.length > 0 ? pool : set;
  let hash = 0;
  for (let i = 0; i < siteId.length; i += 1) {
    hash = (hash * 31 + siteId.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length];
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
function firstSentence(text: string | undefined): string | undefined {
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
 * The copy stack, shared by all three archetypes.
 *
 * The subhead is a `heading` at `h3`, not a `text` node, and that is the single
 * detail that most separates the reference designs from the old output:
 * headings read `--font-secondary` while `text` reads `--font-primary`, so
 * this is what sets the subhead in the display face. `weight: "regular"` keeps
 * it from competing with the headline, and `textTone: "accent"` is what makes
 * it the church's colour rather than muted grey. No new font field, and
 * typography stays out of the model's hands at every layer.
 */
function copyStack(
  copy: HeroCopy,
  opts: {
    align: "left" | "center";
    width?: "narrow" | "normal" | "wide" | "full";
    inverted?: boolean;
    padding?: "2xl";
    /** Archetype C's compact pill, against the square corners A and B use. */
    pill?: boolean;
  }
): BlockNode {
  const children: BlockNode[] = [
    { id: "hero-headline", type: "heading", scale: "display", text: copy.headline },
  ];

  if (copy.subhead) {
    children.push({
      id: "hero-subhead",
      type: "heading",
      scale: "h3",
      weight: "regular",
      text: copy.subhead,
      style: { textTone: "accent" },
    } as BlockNode);
  }

  /**
   * The reference puts ~48px between the subhead and the button where the rest
   * of the stack sits at 24px. A stack has one uniform gap, so the extra space
   * is a spacer rather than a second gap token.
   */
  children.push({ id: "hero-cta-space", type: "spacer", size: "sm" } as BlockNode);
  children.push({
    id: "hero-cta",
    type: "button",
    label: copy.ctaLabel,
    href: copy.ctaHref,
    emphasis: "primary",
    ...(opts.pill ? { shape: "pill" } : {}),
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
        copyStack(copy, {
          align: recipe.align,
          width: recipe.copyWidth,
          inverted: true,
        }),
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
    const text = copyStack(copy, { align: "left", padding: "2xl" });
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
      style: { background: "surface", padding: "none", width: "full", minHeight: "hero" },
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
    style: { background: "surface", padding: "2xl", align: "center", width: "wide" },
    children: [
      copyStack(copy, { align: "center", width: recipe.copyWidth, pill: true }),
      { id: "hero-photo-space", type: "spacer", size: "lg" } as BlockNode,
      {
        id: "hero-photo",
        type: "image",
        src: photo,
        alt: "",
        aspect: recipe.aspect,
        treatment: recipe.treatment,
        style: { width: recipe.photoWidth },
      } as BlockNode,
    ],
  } as BlockNode;
}
