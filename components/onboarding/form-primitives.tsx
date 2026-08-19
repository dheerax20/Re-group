"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The wizard's form furniture.
 *
 * Every step's form is built from these four, which is why the visual work
 * lives here rather than in six near-identical form files: restyling a
 * `FieldGroup` restyles church info, brand, social, features, and publish in
 * one move, and they cannot drift apart afterwards.
 *
 * The SVG here is ornamental and marked `aria-hidden` — the structure a
 * screen reader gets is still a plain `<section>` with a heading.
 */

/**
 * A hairline gradient edge that traces the top of a panel.
 *
 * A gradient *border* would need a doubled background or a pseudo-element
 * trick; a one-pixel SVG line is simpler, scales cleanly, and can fade to
 * transparent at both ends, which a border cannot.
 */
function EdgeLight({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 1"
      className={cn("pointer-events-none absolute inset-x-0 top-0 h-px w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-brand, #6366f1)" stopOpacity="0" />
          <stop offset="35%" stopColor="var(--color-accent, #d4af37)" stopOpacity="0.9" />
          <stop offset="70%" stopColor="var(--color-brand, #6366f1)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--color-brand, #6366f1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="1" fill={`url(#${id}-edge)`} />
    </svg>
  );
}

/**
 * The small glyph beside a group heading.
 *
 * Takes a step number so the eye can count sections without reading them.
 * Drawn rather than typeset because it needs the gradient fill to match the
 * rest of the wizard's palette, and a `background-clip: text` number does not
 * survive a colour-scheme flip as cleanly.
 */
function GroupGlyph({ index }: { index?: number }) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 32 32"
      className="size-8 shrink-0"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-brand, #6366f1)" />
          <stop offset="100%" stopColor="var(--color-accent, #d4af37)" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill={`url(#${id}-fill)`}
        opacity="0.14"
      />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="none"
        stroke={`url(#${id}-fill)`}
        strokeWidth="1.25"
        opacity="0.55"
      />
      {index !== undefined ? (
        <text
          x="16"
          y="21"
          textAnchor="middle"
          className="fill-current text-[11px] font-bold"
          style={{ fontSize: 12, fontWeight: 700 }}
        >
          {index}
        </text>
      ) : (
        <circle cx="16" cy="16" r="3.5" fill={`url(#${id}-fill)`} />
      )}
    </svg>
  );
}

export function FieldGroup({
  title,
  description,
  index,
  children,
  className,
}: {
  title?: string;
  description?: string;
  /** Optional ordinal shown in the glyph, so sections can be counted at a glance. */
  index?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "group/field relative overflow-hidden rounded-2xl border border-border bg-surface-muted/50 p-5",
        "transition-colors duration-300 focus-within:border-brand/40 hover:border-border-strong",
        className
      )}
    >
      <EdgeLight className="opacity-0 transition-opacity duration-500 group-focus-within/field:opacity-100 group-hover/field:opacity-70" />

      {title || description ? (
        <div className="mb-4 flex items-start gap-3">
          <GroupGlyph index={index} />
          <div className="space-y-1">
            {title ? (
              <h3 className="font-serif text-base font-medium tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-snug text-muted">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    // `role="alert"` so the message is announced when it appears — a red line
    // that only exists visually is invisible to anyone filling the form by ear.
    <p role="alert" className="text-[13px] text-destructive">
      {children}
    </p>
  );
}

export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-3 border-t border-border pt-6",
        className
      )}
    >
      {children}
    </div>
  );
}
