/**
 * The block vocabulary AI composes a page from, and the generic renderer
 * (`components/website/blocks/block-renderer.tsx`) walks. Replaces picking
 * among a fixed library of section components with a small, constrained set
 * of generic primitives + style tokens — the AI has real layout freedom, but
 * every token maps to a literal Tailwind class chosen by the renderer, never
 * a raw CSS value the model invents, and every breakpoint is the renderer's
 * decision, not the model's. See `lib/site/blocks/schema.ts` for the zod
 * mirror used to validate/repair AI output and stored data.
 */

export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type AlignToken = "left" | "center" | "right";
export type WidthToken = "narrow" | "normal" | "wide" | "full";
export type SurfaceToken = "transparent" | "surface" | "primary" | "accent" | "inverted";
export type TextToneToken = "default" | "muted" | "inverted" | "accent";
export type TypeScaleToken = "display" | "h1" | "h2" | "h3" | "body" | "small";
export type AccentToken = "none" | "line" | "bordered" | "numbered";
export type ImageTreatmentToken = "rounded" | "square" | "framed" | "bleed";
/** `fill` has no ratio box — the image takes the height of whatever sits beside it. */
export type ImageAspectToken = "square" | "video" | "portrait" | "wide" | "cinema" | "fill";
export type ButtonEmphasisToken = "primary" | "secondary" | "outline";
/** A button's corner. Template-only — the composer never emits it. */
export type ButtonShapeToken = "default" | "pill";
export type ColumnsToken = 1 | 2 | 3 | 4;

/**
 * How a `row` distributes its children.
 *
 * - `columns` — the equal-width grid a content band wants, read together with
 *   `columns`. The default, and the only value the composer ever emits.
 * - `bar` — flex, children pushed to opposite ends. The footer; as an
 *   equal-column grid a two-child bar puts its right side at the container's
 *   horizontal midpoint with a screen's worth of dead space beyond it.
 * - `wide-left` / `wide-right` — a deliberately unequal 3fr/2fr split. The
 *   hero's asymmetric archetype needs a photo column that is narrower than the
 *   text beside it, and equal fractions cannot express that.
 *
 * `columns` is ignored by every value but `columns`.
 */
export type RowLayoutToken = "columns" | "bar" | "wide-left" | "wide-right";

/** Overlay over a section's `backgroundImage`. Meaningless without one. */
export type OverlayToken = "none" | "scrim" | "dark";
export type MinHeightToken = "none" | "hero" | "screen";
/**
 * A heading's weight, decoupled from its size.
 *
 * Template-only — the composer never emits it. It exists because the hero
 * subhead is a `heading` (so it picks up the display face) that has to read at
 * regular weight, while `h3` everywhere else stays semibold.
 */
export type FontWeightToken = "regular" | "semibold" | "bold";

export type BlockStyle = {
  padding?: SpacingToken;
  gap?: SpacingToken;
  align?: AlignToken;
  width?: WidthToken;
  background?: SurfaceToken;
  textTone?: TextToneToken;
  /**
   * A photograph behind a section's content. Template-authored only — the
   * composer never picks a photo, and any URL here is validated by
   * `mediaUrlSchema` on the way in and `safeMediaUrl` on the way out.
   */
  backgroundImage?: string;
  overlay?: OverlayToken;
  minHeight?: MinHeightToken;
};

type BaseBlock = {
  id: string;
  style?: BlockStyle;
};

export type SectionBlock = BaseBlock & { type: "section"; children: BlockNode[] };
export type StackBlock = BaseBlock & { type: "stack"; children: BlockNode[] };
export type RowBlock = BaseBlock & {
  type: "row";
  columns?: ColumnsToken;
  /** Defaults to `columns`; every other value ignores `columns` entirely. */
  layout?: RowLayoutToken;
  children: BlockNode[];
};
export type SpacerBlock = BaseBlock & { type: "spacer"; size?: SpacingToken };

export type HeadingBlock = BaseBlock & {
  type: "heading";
  text: string;
  scale?: TypeScaleToken;
  /** Template-only. Defaults to the weight `scale` implies. */
  weight?: FontWeightToken;
};
/**
 * `scale` is the same `TypeScaleToken` a heading takes, read as a paragraph
 * size by `textScaleClass` — so "make the intro bigger" is one token change
 * rather than a second vocabulary the model has to learn.
 */
export type TextBlock = BaseBlock & { type: "text"; text: string; scale?: TypeScaleToken };
export type EyebrowBlock = BaseBlock & { type: "eyebrow"; text: string; accent?: AccentToken };
export type ImageBlock = BaseBlock & {
  type: "image";
  src?: string;
  videoSrc?: string;
  alt?: string;
  treatment?: ImageTreatmentToken;
  aspect?: ImageAspectToken;
};
export type ButtonBlock = BaseBlock & {
  type: "button";
  label: string;
  href: string;
  emphasis?: ButtonEmphasisToken;
  shape?: ButtonShapeToken;
};
export type StatsBlock = BaseBlock & {
  type: "stats";
  items: Array<{ label: string; value: string }>;
};

/** Data-bound: renders real church data. AI controls only presentation, never content. */
export type NavLinksBlock = BaseBlock & { type: "navLinks" };
export type BrandLogoBlock = BaseBlock & { type: "brandLogo" };
export type SermonCollectionBlock = BaseBlock & {
  type: "sermonCollection";
  layout?: "grid" | "list" | "featured";
  limit?: number;
};
export type EventCollectionBlock = BaseBlock & {
  type: "eventCollection";
  layout?: "grid" | "list" | "calendar";
  limit?: number;
};
/**
 * Ministries have no database table — they were always church-specific copy
 * (the old copy deck wrote them into `config.items`). They therefore travel
 * on the block itself rather than being looked up like sermons/events, and
 * an empty list renders an empty state: the renderer must never invent
 * ministries a church does not actually have.
 */
export type MinistryCollectionBlock = BaseBlock & {
  type: "ministryCollection";
  items?: Array<{ name: string; description: string }>;
};
export type ContactInfoBlock = BaseBlock & { type: "contactInfo" };
export type GivingCtaBlock = BaseBlock & { type: "givingCta" };
export type SocialLinksBlock = BaseBlock & { type: "socialLinks" };
export type CopyrightLineBlock = BaseBlock & { type: "copyrightLine" };

export type BlockNode =
  | SectionBlock
  | StackBlock
  | RowBlock
  | SpacerBlock
  | HeadingBlock
  | TextBlock
  | EyebrowBlock
  | ImageBlock
  | ButtonBlock
  | StatsBlock
  | NavLinksBlock
  | BrandLogoBlock
  | SermonCollectionBlock
  | EventCollectionBlock
  | MinistryCollectionBlock
  | ContactInfoBlock
  | GivingCtaBlock
  | SocialLinksBlock
  | CopyrightLineBlock;

export type ContainerBlockType = "section" | "stack" | "row";

export const CONTAINER_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "section",
  "stack",
  "row",
]);

export const BLOCK_TYPES: ReadonlySet<string> = new Set([
  "section",
  "stack",
  "row",
  "spacer",
  "heading",
  "text",
  "eyebrow",
  "image",
  "button",
  "stats",
  "navLinks",
  "brandLogo",
  "sermonCollection",
  "eventCollection",
  "ministryCollection",
  "contactInfo",
  "givingCta",
  "socialLinks",
  "copyrightLine",
]);

/** A full page is just a list of top-level blocks (almost always one root `section` per visual band). */
export type PageBlocks = BlockNode[];

/** Reserved ids the renderer/layout look for `nav`/`footer` bands by, instead of a `type === "navbar"` scan. */
export const NAV_BLOCK_ID = "nav";
export const FOOTER_BLOCK_ID = "footer";
/**
 * The hero band, which a design template builds rather than the model.
 *
 * Reserved for the same reason as the two above: the band rhythm pass has to
 * be able to leave it alone. Its padding, background, alignment and photograph
 * all come from the template, and the rotation would otherwise overwrite every
 * one of them with the plain page background and 144px of dead space.
 */
export const HERO_BLOCK_ID = "hero";
