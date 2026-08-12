import { BrandConfig } from "./types";
import { fontKeyToCssVar } from "./fonts";
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
