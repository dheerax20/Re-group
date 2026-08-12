import {
  Inter,
  DM_Sans,
  Playfair_Display,
  Cormorant_Garamond,
  Montserrat,
} from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
});
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant-garamond",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export type FontKey =
  | "inter"
  | "dm-sans"
  | "playfair-display"
  | "cormorant-garamond"
  | "montserrat";

/**
 * The only fonts a brand config may reference. Keeping this a fixed
 * registry (rather than arbitrary font URLs) avoids uncontrolled
 * third-party asset loading and keeps Next.js font optimization working.
 */
export const fontRegistry: Record<
  FontKey,
  { label: string; cssVar: string; className: string }
> = {
  inter: { label: "Inter", cssVar: "--font-inter", className: inter.className },
  "dm-sans": {
    label: "DM Sans",
    cssVar: "--font-dm-sans",
    className: dmSans.className,
  },
  "playfair-display": {
    label: "Playfair Display",
    cssVar: "--font-playfair-display",
    className: playfairDisplay.className,
  },
  "cormorant-garamond": {
    label: "Cormorant Garamond",
    cssVar: "--font-cormorant-garamond",
    className: cormorantGaramond.className,
  },
  montserrat: {
    label: "Montserrat",
    cssVar: "--font-montserrat",
    className: montserrat.className,
  },
};

export const fontVariables = [
  inter.variable,
  dmSans.variable,
  playfairDisplay.variable,
  cormorantGaramond.variable,
  montserrat.variable,
].join(" ");

export function isValidFontKey(value: string): value is FontKey {
  return value in fontRegistry;
}

export function fontKeyToCssVar(key: string): string {
  if (isValidFontKey(key)) {
    return `var(${fontRegistry[key].cssVar})`;
  }
  return `var(${fontRegistry.inter.cssVar})`;
}
