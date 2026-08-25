"use client";

import { useId } from "react";
import { fontRegistry, isValidFontKey } from "@/lib/theme/font-registry";
import { HEX_COLOR } from "@/lib/validation/brand";
import { cn } from "@/lib/utils";

/**
 * A miniature of the church's homepage, drawn from the brand form's live values.
 *
 * This is one SVG rather than a scaled-down DOM preview on purpose. A real
 * preview would need the block renderer, the church's content, and a
 * transform that lies about how anything actually reflows; this is honest
 * about being a swatch — it answers "do these five colours work together and
 * is the text readable on that background", which is the only question this
 * step is really asking.
 *
 * Colours arrive straight from the form, so they can legitimately be
 * mid-typing garbage like `#ab`. Every one is validated here rather than
 * trusted: an invalid `fill` makes SVG fall back to black, which would show
 * the church a preview that has nothing to do with what they typed.
 */
function safeColor(value: string | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

export function BrandPreview({
  colors,
  primaryFont,
  secondaryFont,
  churchName,
  className,
}: {
  colors: {
    primary?: string;
    secondary?: string;
    background?: string;
    foreground?: string;
    accent?: string;
  };
  primaryFont?: string;
  secondaryFont?: string;
  churchName: string;
  className?: string;
}) {
  const id = useId();

  const primary = safeColor(colors.primary, "#1E3A5F");
  const secondary = safeColor(colors.secondary, "#D4AF37");
  const background = safeColor(colors.background, "#FFFFFF");
  const foreground = safeColor(colors.foreground, "#111827");
  const accent = safeColor(colors.accent, secondary);

  /**
   * The registry stores a CSS variable, not a family list — next/font defines
   * the variable on the document, so referencing it here renders the real
   * typeface. The literal fallback inside `var()` matters: this SVG can render
   * before the font file has loaded, and without it the text would briefly
   * fall back to the UA default and shift.
   */
  const displayFont = secondaryFont && isValidFontKey(secondaryFont)
    ? fontRegistry[secondaryFont].cssVar
    : undefined;
  const bodyFont = primaryFont && isValidFontKey(primaryFont)
    ? fontRegistry[primaryFont].cssVar
    : undefined;
  const displayStack = displayFont
    ? `var(${displayFont}, Georgia, serif)`
    : "Georgia, 'Times New Roman', serif";
  const bodyStack = bodyFont
    ? `var(${bodyFont}, system-ui, sans-serif)`
    : "system-ui, sans-serif";

  // Long church names overflow a 320-unit canvas; trimming here keeps the
  // mock honest rather than letting text run past the artboard edge.
  const name = churchName.trim().length > 0 ? churchName.trim() : "Your Church";
  const shown = name.length > 22 ? `${name.slice(0, 21)}…` : name;

  return (
    <figure className={cn("space-y-2", className)}>
      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label={`Preview of your site using ${shown}'s colors and fonts`}
        className="w-full rounded-xl border border-border shadow-[var(--shadow-soft)]"
      >
        <defs>
          <linearGradient id={`${id}-hero`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect width="320" height="200" rx="12" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${id}-clip)`}>
          <rect width="320" height="200" fill={background} />

          {/* Nav */}
          <rect width="320" height="26" fill={primary} />
          <text
            x="12"
            y="17"
            fill={background}
            style={{ font: `600 9px ${displayStack}` }}
          >
            {shown}
          </text>
          {[210, 244, 278].map((x) => (
            <rect key={x} x={x} y="11" width="26" height="4" rx="2" fill={background} opacity="0.65" />
          ))}

          {/* Hero */}
          <rect y="26" width="320" height="86" fill={`url(#${id}-hero)`} />
          <text
            x="20"
            y="66"
            fill="#ffffff"
            style={{ font: `700 17px ${displayStack}` }}
          >
            Welcome home
          </text>
          <rect x="20" y="76" width="150" height="4" rx="2" fill="#ffffff" opacity="0.7" />
          <rect x="20" y="85" width="110" height="4" rx="2" fill="#ffffff" opacity="0.5" />
          <rect x="20" y="95" width="58" height="13" rx="6.5" fill={accent} />

          {/* Body cards */}
          <text
            x="20"
            y="130"
            fill={foreground}
            style={{ font: `600 9px ${bodyStack}` }}
          >
            This Sunday
          </text>
          {[20, 122, 224].map((x) => (
            <g key={x}>
              <rect x={x} y="138" width="76" height="46" rx="7" fill={foreground} opacity="0.06" />
              <rect x={x + 9} y="148" width="42" height="4" rx="2" fill={foreground} opacity="0.55" />
              <rect x={x + 9} y="157" width="58" height="3" rx="1.5" fill={foreground} opacity="0.3" />
              <rect x={x + 9} y="164" width="50" height="3" rx="1.5" fill={foreground} opacity="0.3" />
              <rect x={x + 9} y="173" width="24" height="4" rx="2" fill={accent} />
            </g>
          ))}
        </g>
      </svg>

      <figcaption className="flex items-center gap-2 text-[11px] text-muted">
        {[
          ["Primary", primary],
          ["Secondary", secondary],
          ["Accent", accent],
          ["Text", foreground],
        ].map(([label, value]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-3 rounded-full border border-border"
              style={{ backgroundColor: value }}
            />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
