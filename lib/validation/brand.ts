import { z } from "zod";
import { fontRegistry } from "@/lib/theme/font-registry";
import { mediaUrlSchema } from "./url";

/**
 * The one hex pattern in the app. Shorthand is accepted because a church
 * typing `#0f0` means green, but note that `<input type="color">` does NOT
 * accept it — anything feeding a swatch has to go through
 * `normalizeHexColor` first.
 */
export const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const hexColor = z.string().regex(HEX_COLOR, "Must be a valid hex color");

/**
 * Widens any accepted hex to the `#RRGGBB` form, or falls back.
 *
 * Two callers need this and for the same reason: a value read straight off a
 * live form is legitimately mid-typing garbage like `#ab`, and both consumers
 * fail silently on it rather than loudly — `<input type="color">` snaps to
 * black, and an invalid SVG `fill` also renders black. Either would show the
 * church a colour they never chose.
 */
export function normalizeHexColor(value: string | undefined, fallback: string): string {
  const raw = value?.trim() ?? "";
  if (!HEX_COLOR.test(raw)) return fallback;
  if (raw.length === 7) return raw.toUpperCase();
  // #abc -> #AABBCC
  return `#${raw
    .slice(1)
    .split("")
    .map((c) => c + c)
    .join("")}`.toUpperCase();
}

/**
 * Fonts are restricted to the registry because the value becomes a CSS
 * custom property on the published page — an arbitrary string there is a
 * style-injection vector, and an unloaded family silently falls back.
 */
const fontKey = z.enum(Object.keys(fontRegistry) as [string, ...string[]]);

export const brandConfigSchema = z.object({
  colors: z.object({
    primary: hexColor,
    secondary: hexColor,
    background: hexColor,
    foreground: hexColor,
    accent: hexColor,
  }),
  typography: z.object({
    primaryFont: fontKey,
    secondaryFont: fontKey,
  }),
  logo: z.object({
    // Allowed to be empty: a church can publish without a logo, and the
    // renderer falls back to the church name.
    url: mediaUrlSchema.default(""),
    alt: z.string().max(160).default(""),
  }),
  favicon: z.object({
    url: mediaUrlSchema.default(""),
  }),
  tagline: z.string().max(160).optional(),
});

export type BrandConfigInput = z.infer<typeof brandConfigSchema>;

/**
 * What the brand FORM holds, which is not what the schema returns: the
 * `.default("")` fields are optional on the way in and guaranteed on the way
 * out, so React Hook Form's `control` is parameterised on this side of the
 * parse. Anything typing a `Control` for this form needs it.
 */
export type BrandConfigFormValues = z.input<typeof brandConfigSchema>;

export const defaultBrandConfig = {
  colors: {
    primary: "#1E3A5F",
    secondary: "#D4AF37",
    background: "#FFFFFF",
    foreground: "#111827",
    accent: "#D4AF37",
  },
  typography: {
    primaryFont: "inter",
    secondaryFont: "playfair-display",
  },
  logo: { url: "", alt: "" },
  favicon: { url: "" },
  tagline: "",
};
