/**
 * The fonts a church may choose, as plain data.
 *
 * Deliberately free of `next/font`. That module is a build-time transform:
 * calling `Inter({ … })` only works inside a Next.js compilation, and throws
 * "Inter is not a function" anywhere else. Anywhere else includes the two
 * places this data is genuinely needed — a Trigger.dev task bundled by
 * esbuild, and the vitest suite — because `to-site-config` reads the registry
 * to validate a stored font key, and every AI edit path resolves a site
 * through `to-site-config`.
 *
 * So the registry lives here and the actual font loading lives in `./fonts`,
 * which only `app/layout.tsx` imports. The split is what keeps a background
 * job from transitively depending on the Next.js build pipeline.
 */

export type FontKey =
  | "inter"
  | "dm-sans"
  | "playfair-display"
  | "cormorant-garamond"
  | "montserrat"
  | "lato"
  | "roboto"
  | "poppins"
  | "merriweather"
  | "georgia"
  | "helvetica";

type LoadedFontEntry = { label: string; cssVar: string };
/**
 * A font with no Google Fonts entry (Georgia, Helvetica). `next/font` has
 * nothing to load, so this carries a fixed, code-authored font stack instead
 * of a CSS variable — never a value that came from user input, which is the
 * same property the registry restriction below exists to protect.
 */
type StaticFontEntry = { label: string; stack: string };
type FontEntry = LoadedFontEntry | StaticFontEntry;

function isLoadedFont(entry: FontEntry): entry is LoadedFontEntry {
  return "cssVar" in entry;
}

/**
 * The only fonts a brand config may reference. A fixed registry rather than
 * arbitrary font URLs, because these values become CSS custom properties on a
 * public page: it avoids uncontrolled third-party asset loading and keeps
 * Next.js font optimization working.
 */
export const fontRegistry: Record<FontKey, FontEntry> = {
  inter: { label: "Inter", cssVar: "--font-inter" },
  "dm-sans": { label: "DM Sans", cssVar: "--font-dm-sans" },
  "playfair-display": { label: "Playfair Display", cssVar: "--font-playfair-display" },
  "cormorant-garamond": {
    label: "Cormorant Garamond",
    cssVar: "--font-cormorant-garamond",
  },
  montserrat: { label: "Montserrat", cssVar: "--font-montserrat" },
  lato: { label: "Lato", cssVar: "--font-lato" },
  roboto: { label: "Roboto", cssVar: "--font-roboto" },
  poppins: { label: "Poppins", cssVar: "--font-poppins" },
  merriweather: { label: "Merriweather", cssVar: "--font-merriweather" },
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  helvetica: { label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
};

export function isValidFontKey(value: string): value is FontKey {
  return value in fontRegistry;
}

/** Falls back to Inter rather than emitting an undefined custom property. */
export function fontKeyToCssVar(key: string): string {
  const entry = isValidFontKey(key) ? fontRegistry[key] : fontRegistry.inter;
  return isLoadedFont(entry) ? `var(${entry.cssVar})` : entry.stack;
}

/** Whether a key resolves to a fixed literal stack rather than a next/font variable. */
export function isStaticFontKey(key: string): boolean {
  return isValidFontKey(key) && !isLoadedFont(fontRegistry[key]);
}
