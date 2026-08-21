/**
 * Picking a readable text colour for a church's own brand colours.
 *
 * A church types five free-form hex values in the brand step
 * (`lib/validation/brand.ts` only checks the shape), so `--color-primary` can
 * legitimately be `#F5E6C8` or `#101820`. The block renderer used to paint
 * `text-white` on every `background: "primary"` / `"accent"` band regardless,
 * which is invisible on any light brand colour.
 *
 * The choice is deliberately made from the church's OWN palette rather than
 * black/white: a parchment-and-terracotta church should get its ink colour on
 * a terracotta band, not `#000`.
 */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Only used when the church's own two candidates both fail — see `readableOn`. */
const FALLBACK_LIGHT = "#ffffff";
const FALLBACK_DARK = "#000000";

function expand(hex: string): string | null {
  const value = hex.trim();
  if (!HEX.test(value)) return null;
  const body = value.slice(1);
  return body.length === 3
    ? body
        .split("")
        .map((char) => char + char)
        .join("")
    : body;
}

/** sRGB channel to linear light, per WCAG 2.1 relative luminance. */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). Null for an unparseable colour. */
export function relativeLuminance(hex: string): number | null {
  const body = expand(hex);
  if (!body) return null;
  const r = toLinear(Number.parseInt(body.slice(0, 2), 16));
  const g = toLinear(Number.parseInt(body.slice(2, 4), 16));
  const b = toLinear(Number.parseInt(body.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1–21. Null if either is unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The more readable of two candidate text colours on `background`.
 *
 * Falls back to white/near-black only when the church's own pair is
 * unparseable or when neither candidate clears 4.5:1 — a church can pick two
 * mid-tones that both fail against their own primary, and shipping the less
 * bad of two unreadable options would be worse than leaving their palette.
 */
export function readableOn(
  background: string,
  candidates: { light: string; dark: string }
): string {
  const light = contrastRatio(background, candidates.light);
  const dark = contrastRatio(background, candidates.dark);

  if (light === null || dark === null) {
    const luminance = relativeLuminance(background);
    return luminance !== null && luminance > 0.5 ? FALLBACK_DARK : FALLBACK_LIGHT;
  }

  const best = light >= dark ? candidates.light : candidates.dark;
  const bestRatio = Math.max(light, dark);
  if (bestRatio >= 4.5) return best;

  // Neither of the church's own colours is legible here. Fall back to the true
  // extremes rather than a softer near-black: a mid-grey brand colour has no
  // comfortable answer, and against #808080 a near-black only reaches 4.49:1
  // while pure black reaches 5.3:1. Legibility outranks the nicer ink here,
  // and this branch only runs when the church's own palette has already failed.
  const fallbackLight = contrastRatio(background, FALLBACK_LIGHT) ?? 0;
  const fallbackDark = contrastRatio(background, FALLBACK_DARK) ?? 0;
  const fallback = fallbackLight >= fallbackDark ? FALLBACK_LIGHT : FALLBACK_DARK;

  return Math.max(fallbackLight, fallbackDark) > bestRatio ? fallback : best;
}
