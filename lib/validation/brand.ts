import { z } from "zod";
import { fontRegistry } from "@/lib/theme/font-registry";
import { mediaUrlSchema } from "./url";

const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Must be a valid hex color");

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
