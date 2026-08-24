import {
  Inter,
  DM_Sans,
  Playfair_Display,
  Cormorant_Garamond,
  Montserrat,
} from "next/font/google";

/**
 * Loads the church-selectable fonts and exposes their CSS variables.
 *
 * This module CANNOT be imported outside a Next.js compilation — `next/font`
 * is a build-time transform, and these calls throw "Inter is not a function"
 * under esbuild or vitest. `app/layout.tsx` is its only importer, and it must
 * stay that way: anything that merely needs to know which font keys exist,
 * or what CSS variable a key maps to, imports `./font-registry` instead.
 *
 * The names here must stay in step with `fontRegistry`'s `cssVar` values —
 * that registry is what turns a stored key into `var(--font-…)`, and this is
 * what defines those variables on the page.
 */
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

export const fontVariables = [
  inter.variable,
  dmSans.variable,
  playfairDisplay.variable,
  cormorantGaramond.variable,
  montserrat.variable,
].join(" ");
