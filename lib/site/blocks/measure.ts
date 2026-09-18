/**
 * A band's height, computed from its tokens instead of measured in a browser.
 *
 * WHY THIS IS NOT PLAYWRIGHT: a real `getBoundingClientRect()` needs a browser
 * with the compiled stylesheet attached, and this repo has no browser, no
 * jsdom, and no Playwright. `renderToStaticMarkup` (which
 * `tests/site-templates-render.test.tsx` already uses) produces HTML, not
 * layout. So the height is derived from the same token maps the renderer reads
 * — which has the useful property that a token edit moves the model, and a
 * model that drifts from `tokens.ts` cannot compile.
 *
 * THE ONE RULE: this must UNDER-estimate, never over-estimate. A band it calls
 * 1000px tall is at least 1000px tall on a real page. That makes a failed
 * assertion always a real overflow, and pays for it in false negatives — the
 * right direction for a gate that runs in CI. Every judgement call below is
 * resolved toward the smaller number, and each one says so.
 *
 * What is exact: padding, gaps, spacers, `min-height` floors, and an image's
 * ratio box (including whichever `imageMaxHeightClass` ceiling it takes). Those
 * four terms dominate every band this was written to catch.
 *
 * What is a floor: text (lines are estimated from the measure) and the
 * data-bound collection views, whose real height depends on how many sermons a
 * church has. See `DATA_BOUND_FLOOR`.
 */
import {
  gapClass,
  imageAspectClass,
  imageMaxHeightClass,
  minHeightClass,
  paddingClass,
  pinnedBandClass,
  spacerHeightClass,
  stackGapClass,
  textScaleClass,
  headingScaleClass,
  widthClass,
} from "@/components/website/blocks/tokens";
import { FOOTER_BLOCK_ID, NAV_BLOCK_ID } from "./types";
import type { BlockNode, SpacingToken, WidthToken } from "./types";

/** Tailwind's spacing unit: `py-20` is 20 × 0.25rem. */
const SPACING_UNIT_PX = 4;
const REM_PX = 16;

/** Tailwind v4 defaults. */
const BREAKPOINT_SM = 640;
const BREAKPOINT_LG = 1024;
const BREAKPOINT_2XL = 1536;

/**
 * What a data-bound view contributes when we cannot know its rows.
 *
 * `sermonCollection`, `eventCollection` and friends render real church data, so
 * their height is a property of the database rather than of the tree. Zero
 * would be the strictly-safe floor, but it makes a band of nothing but a
 * collection measure as pure padding and hides the exact overflow this file
 * exists to find.
 *
 * So this is the SMALLEST a collection can render: its empty state
 * (`EmptyState` in `components/website/blocks/shared.tsx`), at its narrow
 * breakpoint — `p-8` both sides plus a `size-16` icon badge. Anything with rows
 * in it is taller, and every church's site renders exactly this on build day.
 *
 * Coupled to that component on purpose: it was 180 while the empty state was a
 * gradient card ~204px tall, and shrinking the component without moving this
 * would have quietly turned a floor into an over-estimate — the one thing this
 * model must never do.
 */
const DATA_BOUND_FLOOR = 64 * 2 + 64;

/** A button is `blockButtonSizeClass` — `h-11`, and nothing in it wraps. */
const BUTTON_HEIGHT = 44;

type Viewport = { vw: number; vh: number };

/**
 * Pulls the numeric scale off a spacing utility — `py-20` → 20, `gap-6` → 6.
 *
 * Reading the class string rather than restating the scale is deliberate: a
 * change to `paddingClass` has to move this model, and if someone replaces a
 * value with something this cannot parse it throws here rather than silently
 * measuring zero.
 *
 * `vw` resolves breakpoints, and it is not optional. `paddingClass` is
 * responsive (`py-12 sm:py-16 lg:py-20 2xl:py-22`), and a reader that took the
 * first match would measure a 1440px desktop band at its 390px padding —
 * under-reporting EVERY band by 64-128px and turning the height gate green on
 * a page that never changed. That is a worse failure than the one the gate
 * exists to catch, so the breakpoint handling lives here rather than at the
 * call sites.
 *
 * All three variants, widest first. `2xl` is unused by the viewports the gate
 * currently measures, but `paddingClass` tops out there — so a model that
 * stopped at `lg` would under-report above 1536px, silently, which is exactly
 * the failure shape this function was written to close.
 */
function spacingScale(className: string, prefix: string, vw: number): number {
  const at = (bp: string) =>
    className.match(new RegExp(`(?:^|\\s)${bp}:${prefix}-(\\d+)(?:\\s|$)`));
  const base = className.match(new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`));

  const xl2 = vw >= BREAKPOINT_2XL ? at("2xl") : null;
  const lg = vw >= BREAKPOINT_LG ? at("lg") : null;
  const sm = vw >= BREAKPOINT_SM ? at("sm") : null;
  const match = xl2 ?? lg ?? sm ?? base;

  if (!match) throw new Error(`measure: cannot read a ${prefix}-* scale out of "${className}"`);
  return Number(match[1]) * SPACING_UNIT_PX;
}

/** `py-*` is both sides. */
function paddingFor(token: SpacingToken | undefined, fallback: SpacingToken, vw: number): number {
  return spacingScale(paddingClass[token ?? fallback], "py", vw) * 2;
}

function gapFor(token: SpacingToken | undefined, fallbackClass: string, vw: number): number {
  return spacingScale(token ? gapClass[token] : fallbackClass, "gap", vw);
}

function stackGapFor(token: SpacingToken | undefined, fallbackClass: string, vw: number): number {
  return spacingScale(token ? stackGapClass[token] : fallbackClass, "gap", vw);
}

/**
 * The usable content width inside a band, at a given viewport.
 *
 * Each `widthClass` entry is `mx-auto w-full max-w-Nxl px-6 lg:px-14`, so the
 * measure caps the PADDED box and the gutter comes off the inside — usable
 * width is `min(vw, max-w) − gutter`, not `max-w`. Getting this backwards
 * overstates every image by 112px at `lg`, which is why it is one function.
 */
export function contentWidthFor(width: WidthToken, vw: number): number {
  const className = widthClass[width];

  const gutter = (() => {
    if (!className.includes("px-")) return 0;
    const lg = className.match(/lg:px-(\d+)/);
    const base = className.match(/(?:^|\s)px-(\d+)/);
    const scale = vw >= BREAKPOINT_LG && lg ? Number(lg[1]) : Number(base?.[1] ?? 0);
    return scale * SPACING_UNIT_PX * 2;
  })();

  const measure = className.match(/max-w-(\d+)xl/);
  // Tailwind's `max-w-Nxl` ramp: 2xl = 42rem, 4xl = 56rem, 6xl = 72rem.
  const MEASURE_REM: Record<string, number> = { "2": 42, "4": 56, "6": 72 };
  const cap = measure ? (MEASURE_REM[measure[1]] ?? 0) * REM_PX : Infinity;

  return Math.max(0, Math.min(vw, cap) - gutter);
}

/** `aspect-square` → 1, `aspect-video` → 16/9, `aspect-[4/5]` → 0.8. `fill` has no box. */
function aspectRatio(className: string): number | null {
  if (className.includes("aspect-square")) return 1;
  if (className.includes("aspect-video")) return 16 / 9;
  const explicit = className.match(/aspect-\[(\d+)\/(\d+)\]/);
  if (explicit) return Number(explicit[1]) / Number(explicit[2]);
  return null;
}

/** `max-h-[52svh]` → 0.52. Read off the class so the two ceilings stay in step. */
function svhFraction(className: string): number {
  const match = className.match(/max-h-\[(\d+)svh\]/);
  if (!match) throw new Error(`measure: cannot read an svh ceiling out of "${className}"`);
  return Number(match[1]) / 100;
}

/** `min-h-[70vh] lg:min-h-[78vh]` / `min-h-svh` → px at this viewport. */
function minHeightFloor(className: string, { vh, vw }: Viewport): number {
  if (className.includes("min-h-svh")) return vh;
  const lg = className.match(/lg:min-h-\[(\d+)vh\]/);
  const base = className.match(/(?:^|\s)min-h-\[(\d+)vh\]/);
  const pct = vw >= BREAKPOINT_LG && lg ? Number(lg[1]) : Number(base?.[1] ?? 0);
  return (pct / 100) * vh;
}

/**
 * The rendered font size of a type-scale class at a viewport.
 *
 * Every scale climbs past `sm` and most again at `lg`, so the step actually in
 * play depends on the width being measured — a `display` heading is 48px on a
 * phone and 60px on a laptop.
 */
const FONT_SIZE_REM: Record<string, number> = {
  "text-base": 1,
  "text-lg": 1.125,
  "text-xl": 1.25,
  "text-2xl": 1.5,
  "text-3xl": 1.875,
  "text-4xl": 2.25,
  "text-5xl": 3,
  "text-6xl": 3.75,
};

/** Tailwind's paired line-height for each step, and the `leading-*` overrides. */
const DEFAULT_LEADING: Record<string, number> = {
  "text-base": 1.5,
  "text-lg": 1.556,
  "text-xl": 1.4,
  "text-2xl": 1.333,
  "text-3xl": 1.2,
  "text-4xl": 1.111,
  "text-5xl": 1,
  "text-6xl": 1,
};

const LEADING_OVERRIDE: Record<string, number> = {
  "leading-tight": 1.25,
  "leading-snug": 1.375,
  "leading-relaxed": 1.625,
};

function typeMetrics(className: string, { vw }: Viewport): { size: number; leading: number } {
  // `text-xl` must be spelled out: an `[0-9a-z]+xl` alternation needs a
  // character before the `xl` and so silently skips it, which would measure
  // every `xl` step at the 16px fallback.
  const steps = [...className.matchAll(/(?:^|\s)(?:(sm|lg):)?(text-(?:base|lg|xl|[0-9]xl))(?:\s|$)/g)];

  let chosen = "text-base";
  for (const [, breakpoint, step] of steps) {
    if (!(step in FONT_SIZE_REM)) continue;
    const min = breakpoint === "lg" ? BREAKPOINT_LG : breakpoint === "sm" ? BREAKPOINT_SM : 0;
    if (vw >= min) chosen = step;
  }

  const explicitLeading = className.match(/leading-\[([\d.]+)\]/);
  const namedLeading = Object.keys(LEADING_OVERRIDE).find((k) => className.includes(k));

  return {
    size: FONT_SIZE_REM[chosen] * REM_PX,
    leading: explicitLeading
      ? Number(explicitLeading[1])
      : namedLeading
        ? LEADING_OVERRIDE[namedLeading]
        : DEFAULT_LEADING[chosen],
  };
}

/**
 * How many lines a string takes, as a FLOOR.
 *
 * The measure is whichever is narrower: the class's own `max-w-[NNch]` (or
 * `max-w-[NNvw]`, or a rem cap) and the container. Characters per line assumes
 * an average advance of 0.5em, which is on the generous side for the faces a
 * church actually picks — a generous advance fits more characters, which
 * yields FEWER lines, which is the under-estimating direction this file
 * requires.
 */
function lineCount(text: string, className: string, containerWidth: number, size: number, vw: number): number {
  const EM_PER_CHAR = 0.5;
  const charWidth = size * EM_PER_CHAR;

  const chMeasure = className.match(/max-w-\[(\d+)ch\]/);
  const vwMeasure = className.match(/max-w-\[(\d+)vw\]/);
  const remMeasure = className.match(/max-w-(\d+)xl/);
  const REM_CAP: Record<string, number> = { "2": 42, "4": 56, "6": 72 };

  const measurePx = vwMeasure
    ? (Number(vwMeasure[1]) / 100) * vw
    : remMeasure
      ? (REM_CAP[remMeasure[1]] ?? Infinity) * REM_PX
      : Infinity;

  const charsFromWidth = Math.floor(Math.min(containerWidth, measurePx) / charWidth);
  const charsPerLine = chMeasure ? Math.min(Number(chMeasure[1]), charsFromWidth) : charsFromWidth;

  if (charsPerLine < 1) return 1;
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function textHeight(
  text: string,
  className: string,
  containerWidth: number,
  viewport: Viewport
): number {
  const { size, leading } = typeMetrics(className, viewport);
  return lineCount(text, className, containerWidth, size, viewport.vw) * size * leading;
}

/**
 * One node's contribution to its parent's height.
 *
 * `width` is the usable width the parent has already resolved for its
 * children, which is what an image's ratio box and a paragraph's measure are
 * both read against.
 */
function nodeHeight(node: BlockNode, width: number, viewport: Viewport): number {
  switch (node.type) {
    case "section":
      return sectionHeight(node, viewport);

    case "stack": {
      const inner = node.style?.width ? contentWidthFor(node.style.width, viewport.vw) : width;
      const gap = stackGapFor(node.style?.gap, "gap-4", viewport.vw);
      const padding = node.style?.padding ? paddingFor(node.style.padding, "none", viewport.vw) : 0;
      return padding + childrenHeight(node.children, inner, viewport, gap);
    }

    /**
     * A row is the one container whose children sit SIDE BY SIDE, so its
     * height is the tallest child, not the sum — and below its breakpoint
     * every layout in `rowLayoutClass` collapses to one column, where it is
     * the sum again. `tests/blocks-tokens.test.ts` is what guarantees that
     * collapse, so this can rely on it.
     */
    case "row": {
      const layout = node.layout ?? "columns";
      const collapsed = layout === "bar" ? false : viewport.vw < (layout === "columns" ? BREAKPOINT_SM : BREAKPOINT_LG);
      const gap = gapFor(node.style?.gap, layout === "bar" ? "gap-6" : "gap-8", viewport.vw);

      if (collapsed) return childrenHeight(node.children, width, viewport, gap);

      const columns = layout === "columns" ? (node.columns ?? 2) : 2;
      const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
      const heights = node.children.map((child) => nodeHeight(child, columnWidth, viewport));
      return heights.length > 0 ? Math.max(...heights) : 0;
    }

    case "spacer":
      return spacingScale(spacerHeightClass[node.size ?? "md"], "h", viewport.vw);

    case "heading":
      return textHeight(node.text, headingScaleClass[node.scale ?? "h2"], width, viewport);

    case "text":
      return textHeight(node.text, textScaleClass[node.scale ?? "body"], width, viewport);

    /**
     * An image's height is its width over its ratio, then the renderer's
     * `max-h-[70svh]` cap — which is exact, and is the single most useful term
     * in this whole file. `fill` has no ratio box and takes the height of
     * whatever sits beside it, so it contributes nothing of its own.
     */
    case "image": {
      const aspectToken = node.aspect ?? "wide";
      const ratio = aspectRatio(imageAspectClass[aspectToken]);
      if (ratio === null) return 0;
      const box = node.style?.width ? contentWidthFor(node.style.width, viewport.vw) : width;
      const ceiling = svhFraction(imageMaxHeightClass[node.maxHeight ?? "content"]);
      return Math.min(box / ratio, ceiling * viewport.vh);
    }

    case "button":
      return BUTTON_HEIGHT;

    /**
     * Inline chrome — a logo, a nav list, a copyright line. Each is a single
     * line of text or a small mark, and none of them is ever the reason a band
     * clears a viewport. Counted as zero rather than guessed at, per the
     * under-estimate rule.
     */
    case "eyebrow":
    case "brandLogo":
    case "navLinks":
    case "copyrightLine":
    case "socialLinks":
      return 0;

    /**
     * Data-bound. Real height is a property of the church's database, so this
     * is a floor — see `DATA_BOUND_FLOOR`.
     */
    default:
      return DATA_BOUND_FLOOR;
  }
}

function childrenHeight(
  children: readonly BlockNode[],
  width: number,
  viewport: Viewport,
  gap: number
): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((total, child) => total + nodeHeight(child, width, viewport), 0);
  return sum + gap * (children.length - 1);
}

/**
 * A top-level band's height.
 *
 * Mirrors the renderer's own composition (`block-renderer.tsx`, the `section`
 * case): padding lives on the `<section>` and falls back to `lg` when absent —
 * an omitted `padding` is NOT zero — while the children sit in a
 * `flex flex-col` inside the `widthClass` box with a `gap-6` fallback. A band
 * carrying `minHeight` takes that as a floor.
 */
export function estimateBandHeight(band: BlockNode, vw: number, vh: number): number {
  return sectionHeight(band, { vw, vh });
}

function sectionHeight(node: BlockNode, viewport: Viewport): number {
  if (node.type !== "section") return nodeHeight(node, contentWidthFor("wide", viewport.vw), viewport);

  // Chrome. `SiteHeader` owns the nav's height and it is rhythm-exempt; the
  // footer's padding is fixed by `pinnedBandClass` and ignores its token.
  if (node.id === NAV_BLOCK_ID) return 0;

  const width = node.style?.width ?? "wide";
  const contentWidth = contentWidthFor(width, viewport.vw);

  if (node.id === FOOTER_BLOCK_ID) {
    const padding = spacingScale(pinnedBandClass.footer, "py", viewport.vw) * 2;
    return padding + childrenHeight(node.children, contentWidth, viewport, 0);
  }

  const padding = paddingFor(node.style?.padding, "lg", viewport.vw);
  const gap = gapFor(node.style?.gap, "gap-6", viewport.vw);
  const content = childrenHeight(node.children, contentWidth, viewport, gap);
  const floor = minHeightFloor(minHeightClass[node.style?.minHeight ?? "none"], viewport);

  return Math.max(padding + content, floor);
}
