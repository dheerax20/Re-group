import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Must be a valid hex color");

export const brandConfigSchema = z.object({
  colors: z.object({
    primary: hexColor,
    secondary: hexColor,
    background: hexColor,
    foreground: hexColor,
    accent: hexColor,
  }),
  typography: z.object({
    primaryFont: z.string().min(1),
    secondaryFont: z.string().min(1),
  }),
  logo: z.object({
    url: z.string().min(1),
    alt: z.string().default(""),
  }),
  favicon: z.object({
    url: z.string().default(""),
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
