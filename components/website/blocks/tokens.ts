import type {
  AlignToken,
  ButtonEmphasisToken,
  ColumnsToken,
  FontWeightToken,
  FontFamilyToken,
  ImageAspectToken,
  ImageTreatmentToken,
  MinHeightToken,
  OverlayToken,
  RowLayoutToken,
  SpacingToken,
  SurfaceToken,
  TextToneToken,
  TypeScaleToken,
  WidthToken,
} from "@/lib/site/blocks/types";

/**
 * Every token maps to a literal, static Tailwind class string here — never
 * string interpolation (`` `py-${x}` ``) — so Tailwind's build-time class
 * scanner can see every class that will ever be used. This file is the ONLY
 * place a token becomes a class; the renderer never invents one inline.
 */

export const paddingClass: Record<SpacingToken, string> = {
  none: "py-0",
  xs: "py-6",
  sm: "py-10",
  md: "py-16",
  lg: "py-20",
  xl: "py-28",
  "2xl": "py-36",
};

export const gapClass: Record<SpacingToken, string> = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-10",
  xl: "gap-14",
  "2xl": "gap-20",
};

/**
 * A `stack`'s spacing — flex gaps, not `space-y-*`.
 *
 * Same distances, deliberately: `space-y-4` on a `flex flex-col` and `gap-4`
 * are pixel-identical, so nothing published changes. What changes is that a
 * gap is a property of the flex CONTAINER, while `space-y-*` is a margin on
 * `> * + *`. The editor preview wraps every block in a `display: contents` div
 * so the outline panel can find it, and a `contents` element generates no box
 * — so it silently swallows that margin and the stack collapsed in the preview
 * while rendering correctly on the live site. A gap has no such hole.
 */
export const stackGapClass: Record<SpacingToken, string> = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
  "2xl": "gap-10",
};

export const spacerHeightClass: Record<SpacingToken, string> = {
  none: "h-0",
  xs: "h-2",
  sm: "h-4",
  md: "h-8",
  lg: "h-12",
  xl: "h-20",
  "2xl": "h-32",
};

export const alignItemsClass: Record<AlignToken, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/**
 * The pinned footer band.
 *
 * Chrome, not a content band, and the one place the model's `padding` token is
 * deliberately ignored: the composer is required to emit the footer as a
 * top-level `section`, a band's padding scale starts at `py-10` and climbs to
 * `py-36`, and an obedient model wrapped one line of text in 160px of air. The
 * rule is what separates a bar from a band.
 *
 * The nav has no entry here — `components/website/blocks/site-header.tsx` owns
 * its height, because the `transparent` variant needs a number that is
 * knowable at authoring time rather than one a rhythm pass assigns.
 */
export const pinnedBandClass = {
  footer: "py-12 border-t border-site-muted/15 sm:py-16",
} as const;

/**
 * How a `row` lays its children out.
 *
 * `bar` is a flex bar with the children pushed apart — the footer's copyright
 * hard left, its links hard right. It never collapses to a stacked column.
 *
 * `wide-left` / `wide-right` are the asymmetric splits the hero's split
 * archetype needs: `rowColumnsClass` can only ever draw equal fractions, and a
 * photo column that matches the text column beside it is not the design. Both
 * still collapse to a single column before `lg`, which is the invariant
 * `tests/blocks-tokens.test.ts` asserts.
 *
 * `wide-right` mirrors with CSS `order`, never by reordering the children. DOM
 * order is always copy-then-photo, because below `lg` the grid is one column
 * and a phone visitor must not meet a full-height photograph before any words.
 * Reversing at `lg` puts the narrow (2fr) column first visually while the
 * markup still reads copy first.
 */
export const rowLayoutClass: Record<RowLayoutToken, string> = {
  columns: "grid w-full items-center",
  bar: "flex w-full flex-wrap items-center justify-between",
  "wide-left": "grid w-full grid-cols-1 lg:grid-cols-[3fr_2fr]",
  "wide-right":
    "grid w-full grid-cols-1 lg:grid-cols-[2fr_3fr] lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1",
};

/**
 * The wash over a section's `backgroundImage`.
 *
 * `scrim` is a horizontal gradient for left-ranged copy — it protects the text
 * side and lets the right of the photograph breathe. `dark` is flat, for
 * centred copy that crosses the whole frame. Both are dark enough that
 * `textTone: "inverted"` clears contrast at the overlay's lightest point,
 * which is why `enforceBlockLegibility` treats them as a dark surface.
 */
export const overlayClass: Record<OverlayToken, string> = {
  none: "",
  scrim: "bg-gradient-to-r from-black/75 via-black/45 to-black/10",
  dark: "bg-black/55",
};

/**
 * A section's floor height.
 *
 * `min-h-svh`, never `min-h-screen`: `100vh` on mobile Safari is taller than
 * the visible viewport, which pushes the hero's button underneath the browser
 * chrome. A section carrying one of these also centres its content vertically
 * — see the renderer — so copy sits on the optical centre line rather than
 * pinned to the top of a 78vh box.
 */
export const minHeightClass: Record<MinHeightToken, string> = {
  none: "",
  hero: "min-h-[70vh] lg:min-h-[78vh]",
  screen: "min-h-svh",
};

/**
 * A heading's weight, decoupled from its size.
 *
 * The hero subhead is a `heading` so that it picks up `--font-secondary` (the
 * display face) — `text` reads `--font-primary` — but it has to sit at regular
 * weight, while `h3` everywhere else stays semibold. Splitting weight off the
 * scale is what lets the hero have that without restyling every other band's
 * sub-head.
 */
export const fontWeightClass: Record<FontWeightToken, string> = {
  regular: "font-normal",
  semibold: "font-semibold",
  bold: "font-bold",
};

/**
 * The church's two brand faces.
 *
 * Both utilities come from `--font-site-primary` / `--font-site-secondary` in
 * `app/globals.css`'s `@theme inline` block, so nothing new has to be declared
 * for them to exist.
 *
 * A class is required rather than left to inheritance because
 * `.theme-root :is(h1..h6) { font-family: inherit }` in `@layer base` pins
 * every heading to the primary face. A utility sits in a later cascade layer
 * and wins — which is the whole reason `--font-secondary` can finally reach a
 * published page at all.
 */
export const fontFamilyClass: Record<FontFamilyToken, string> = {
  primary: "font-site-primary",
  secondary: "font-site-secondary",
};

/**
 * The one horizontal inset on a published page.
 *
 * The navbar, the footer and any `width: "full"` band all sit at exactly this
 * gutter and nothing else, which is what puts the nav logo and a full-bleed
 * hero headline on the same vertical axis. Contained bands resolve a
 * `max-w-* mx-auto` measure INSIDE it — a centred band is deliberately not on
 * the nav axis and should not be forced onto it.
 *
 * One constant, not a per-token padding: the previous `px-4 sm:px-6 lg:px-8`
 * repeated on each width meant a full-bleed element and a contained one
 * disagreed about where the page began.
 */
export const PAGE_GUTTER = "px-6 lg:px-14";

/**
 * Spelled out rather than interpolating `PAGE_GUTTER`, per this file's own
 * rule. Both halves would be literal, so today's scanner would in fact see
 * every class — but the rule exists so that nobody has to reason about that,
 * and a token map is the wrong place to start making exceptions.
 * `tests/blocks-tokens.test.ts` asserts these stay in step with `PAGE_GUTTER`.
 */
export const widthClass: Record<WidthToken, string> = {
  narrow: "mx-auto w-full max-w-2xl px-6 lg:px-14",
  normal: "mx-auto w-full max-w-4xl px-6 lg:px-14",
  wide: "mx-auto w-full max-w-6xl px-6 lg:px-14",
  /** Gutter only — no measure. The full-bleed tier the nav shares. */
  full: "w-full px-6 lg:px-14",
  /**
   * No inset whatever. Only for a band whose children carry their own gutter —
   * a photograph bleeding into the corner of the viewport cannot do it through
   * a padded parent.
   */
  bleed: "w-full",
};

/**
 * Band backgrounds.
 *
 * A church's primary/secondary is NEVER painted as a solid full-bleed band.
 * A saturated brand colour behind a whole section is the single fastest way a
 * generated site looks like a template — and with a strong blue or red it
 * makes every heading inside it a contrast problem. The brand appears as a
 * wash of at most 10% instead, over the church's own background.
 *
 * `transparent` and `surface` used to be the same pixel: `.theme-root` already
 * paints `--color-background`, so `bg-site-background` on a band inside it
 * changed nothing, and alternating between the two produced no visible rhythm
 * at all. `surface` is now the whisper tint that makes the alternation real.
 *
 * `inverted` (the church's own ink) is kept because a dark band is a genuine
 * editorial device, but nothing assigns it automatically — see
 * `lib/site/blocks/design-pass.ts`.
 */
export const backgroundClass: Record<SurfaceToken, string> = {
  transparent: "bg-transparent",
  surface: "bg-site-primary/5 text-site-foreground",
  primary: "bg-site-primary/10 text-site-foreground",
  accent: "bg-site-accent/10 text-site-foreground",
  inverted: "bg-site-foreground text-site-background",
};

export const textToneClass: Record<TextToneToken, string> = {
  default: "text-site-foreground",
  muted: "text-site-muted",
  inverted: "text-site-background",
  accent: "text-site-accent",
};

/**
 * The one type scale for a church site.
 *
 * Every size on a published page resolves through this map or `textScaleClass`
 * below — including the hand-written sermons/events listing routes, which used
 * to carry their own `text-3xl` headings and drifted a full step smaller than
 * the same heading rendered as a block.
 *
 * Each step keeps climbing past `sm`. A church site is read on a laptop far
 * more often than the 640px breakpoint suggests, and a scale that stops at
 * `sm:` leaves a 36px h2 sitting in the middle of a 1440px band — legible, but
 * unmistakably a template.
 */
export const headingScaleClass: Record<TypeScaleToken, string> = {
  /**
   * The hero headline, and in practice the page's only `display` heading
   * (`capDisplayHeadings` enforces that). Measured off the approved reference:
   * two lines for a typical headline, never one long line, which is what
   * `max-w-2xl` buys that a character count did not.
   */
  display: "text-balance max-w-2xl text-5xl font-semibold leading-[1.1] tracking-tight lg:text-6xl",
  h1: "text-balance max-w-[24ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl",
  h2: "text-balance max-w-[28ch] text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
  h3: "text-balance max-w-[36ch] text-2xl font-semibold tracking-tight sm:text-3xl",
  body: "text-balance max-w-[52ch] text-lg sm:text-xl",
  small: "text-balance max-w-[60ch] text-base",
};

/**
 * The SAME tokens, read as paragraph sizes.
 *
 * One enum covers both block types rather than two competing vocabularies: the
 * model (and the editor's size control) picks a token, and the renderer decides
 * what that token means for the element it is rendering. `h3` on a heading is a
 * sub-head; `h3` on a paragraph is a lead paragraph. That is the same division
 * of labour every other token in this file follows.
 *
 * The `max-w-[..ch]` on every step is the measure, and it tightens as the type
 * grows — 65-75 characters is the readable line, and a 48px lead paragraph
 * hits that at half the character count a 16px one does. Without it a
 * paragraph inherits the band's `max-w-6xl` and runs past 100 characters,
 * which is the quiet reason a generated page reads as unedited even when the
 * words are fine.
 */
export const textScaleClass: Record<TypeScaleToken, string> = {
  display: "text-pretty max-w-[26ch] text-3xl leading-snug sm:text-4xl lg:text-5xl",
  h1: "text-pretty max-w-[30ch] text-3xl leading-snug sm:text-4xl",
  h2: "text-pretty max-w-[38ch] text-2xl leading-snug sm:text-3xl",
  h3: "text-pretty max-w-[48ch] text-xl leading-relaxed sm:text-2xl",
  body: "text-pretty max-w-[68ch] text-base leading-relaxed sm:text-lg",
  small: "text-pretty max-w-[72ch] text-base leading-relaxed",
};

/** `row`'s column count, mapped to a Tailwind grid that always collapses to one column below `sm` — responsiveness is structural, not an AI decision. */
export const rowColumnsClass: Record<ColumnsToken, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export const imageTreatmentClass: Record<ImageTreatmentToken, string> = {
  rounded: "rounded-2xl",
  square: "rounded-none",
  framed: "rounded-3xl border-8 border-site-background",
  bleed: "rounded-none",
};

export const imageAspectClass: Record<ImageAspectToken, string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[4/5]",
  wide: "aspect-[4/3]",
  cinema: "aspect-[21/9]",
  /**
   * No ratio box. For a column that must match the height of the text beside
   * it rather than impose its own — the bleeding photo in the hero's split
   * archetype. Everywhere else a ratio is what stops the page shifting.
   */
  fill: "h-full w-full object-cover",
};

export const buttonEmphasisVariant: Record<ButtonEmphasisToken, "site" | "outline" | "secondary"> = {
  primary: "site",
  secondary: "secondary",
  outline: "outline",
};

/**
 * A block button's size, overriding the shared `buttonVariants` scale.
 *
 * 44px, not the app chrome's 40px. A published church page is read on a phone
 * far more often than the dashboard is, and 44px is the tap target below which
 * a control starts getting missed. `px-8` gives the label room to read as a
 * page-level call to action rather than a form control.
 */
export const blockButtonSizeClass = "h-11 px-8 text-base";


/**
 * The keyboard focus ring for every link a published page renders.
 *
 * Kept here rather than repeated inline so it stays one ring: a page where
 * some links show focus and others don't is worse than one where none do,
 * because a keyboard visitor cannot tell whether they have lost their place.
 * `:focus-visible` rather than `:focus`, so a mouse click doesn't leave a ring
 * behind. Painted in the church's accent over the church's background, since
 * the browser default is invisible on a dark band.
 */
export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent focus-visible:ring-offset-2 focus-visible:ring-offset-site-background";
