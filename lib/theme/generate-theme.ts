import { BrandConfig } from "./types";
import { fontKeyToCssVar } from "./font-registry";
import { readableOn } from "./contrast";
import type { CSSProperties } from "react";

/**
 * Turns a brand config into CSS custom properties. Templates/sections must
 * consume colors and fonts only through these semantic tokens
 * (bg-primary, text-foreground, font-primary, ...) — never hardcode a hex
 * value or font name inside a section component.
 */
export function generateThemeStyle(brand: BrandConfig): CSSProperties {
  return {
    ["--color-primary" as string]: brand.colors.primary,
    ["--color-secondary" as string]: brand.colors.secondary,
    ["--color-background" as string]: brand.colors.background,
    ["--color-foreground" as string]: brand.colors.foreground,
    ["--color-accent" as string]: brand.colors.accent,
    ["--color-muted" as string]: `${brand.colors.foreground}99`,
    /**
     * Text colour for a band filled with the brand's primary/accent. Computed
     * per church rather than hardcoded to white: a church may pick a pale
     * primary, and `text-white` on it is invisible. Candidates come from the
     * church's own palette so a band still reads as theirs.
     */
    ["--color-primary-foreground" as string]: readableOn(brand.colors.primary, {
      light: brand.colors.background,
      dark: brand.colors.foreground,
    }),
    ["--color-accent-foreground" as string]: readableOn(brand.colors.accent, {
      light: brand.colors.background,
      dark: brand.colors.foreground,
    }),
    ["--font-primary" as string]: fontKeyToCssVar(brand.typography.primaryFont),
    ["--font-secondary" as string]: fontKeyToCssVar(
      brand.typography.secondaryFont
    ),
  };
}

export function generateThemeCss(brand: BrandConfig): string {
  const style = generateThemeStyle(brand);
  const lines = Object.entries(style).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}
