import type {
  AlignToken,
  ButtonEmphasisToken,
  ColumnsToken,
  ImageAspectToken,
  ImageTreatmentToken,
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

export const justifyClass: Record<AlignToken, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export const widthClass: Record<WidthToken, string> = {
  narrow: "mx-auto w-full max-w-2xl px-4 sm:px-6",
  normal: "mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8",
  wide: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  full: "mx-auto w-full px-4 sm:px-6 lg:px-8",
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
  display: "text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl",
  h1: "text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl",
  h2: "text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
  h3: "text-2xl font-semibold tracking-tight sm:text-3xl",
  body: "text-lg sm:text-xl",
  small: "text-base",
};

/**
 * The SAME tokens, read as paragraph sizes.
 *
 * One enum covers both block types rather than two competing vocabularies: the
 * model (and the editor's size control) picks a token, and the renderer decides
 * what that token means for the element it is rendering. `h3` on a heading is a
 * sub-head; `h3` on a paragraph is a lead paragraph. That is the same division
 * of labour every other token in this file follows.
 */
export const textScaleClass: Record<TypeScaleToken, string> = {
  display: "text-3xl leading-snug sm:text-4xl lg:text-5xl",
  h1: "text-3xl leading-snug sm:text-4xl",
  h2: "text-2xl leading-snug sm:text-3xl",
  h3: "text-xl leading-relaxed sm:text-2xl",
  body: "text-lg leading-relaxed sm:text-xl",
  small: "text-base leading-relaxed",
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
};

export const buttonEmphasisVariant: Record<ButtonEmphasisToken, "site" | "outline" | "secondary"> = {
  primary: "site",
  secondary: "secondary",
  outline: "outline",
};
