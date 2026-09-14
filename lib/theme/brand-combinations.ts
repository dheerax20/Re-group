import type { FontKey } from "./font-registry";

/** A preset color + font pairing a church can start from in the Brand step. */
export type BrandCombination = {
  id: string;
  name: string;
  colors: { primary: string; secondary: string };
  typography: { primaryFont: FontKey; secondaryFont: FontKey };
};

export const brandCombinations: BrandCombination[] = [
  {
    id: "classic-navy-coral",
    name: "Classic Navy & Coral",
    colors: { primary: "#1B3A5C", secondary: "#FF6F61" },
    typography: { primaryFont: "playfair-display", secondaryFont: "lato" },
  },
  {
    id: "elegant-black-gold",
    name: "Elegant Black & Gold",
    colors: { primary: "#000000", secondary: "#D4AF37" },
    typography: { primaryFont: "georgia", secondaryFont: "helvetica" },
  },
  {
    id: "modern-teal-orange",
    name: "Modern Teal & Orange",
    colors: { primary: "#008080", secondary: "#FF7F11" },
    typography: { primaryFont: "montserrat", secondaryFont: "roboto" },
  },
  {
    id: "bold-purple-yellow",
    name: "Bold Purple & Yellow",
    colors: { primary: "#6A0DAD", secondary: "#FFD700" },
    typography: { primaryFont: "poppins", secondaryFont: "merriweather" },
  },
  {
    id: "fresh-mint-charcoal",
    name: "Fresh Mint & Charcoal",
    colors: { primary: "#3EB489", secondary: "#333333" },
    typography: { primaryFont: "helvetica", secondaryFont: "georgia" },
  },
  {
    id: "warm-crimson-cream",
    name: "Warm Crimson & Cream",
    colors: { primary: "#DC143C", secondary: "#FFFDD0" },
    typography: { primaryFont: "merriweather", secondaryFont: "poppins" },
  },
  {
    id: "bright-sky-sunshine",
    name: "Bright Sky Blue & Sunshine Yellow",
    colors: { primary: "#87CEEB", secondary: "#FFDB58" },
    typography: { primaryFont: "roboto", secondaryFont: "montserrat" },
  },
  {
    id: "earthy-forest-beige",
    name: "Earthy Forest Green & Beige",
    colors: { primary: "#228B22", secondary: "#F5F5DC" },
    typography: { primaryFont: "lato", secondaryFont: "playfair-display" },
  },
];
