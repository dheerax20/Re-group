"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The wizard's visual language, as inline SVG.
 *
 * Inline rather than image files for three reasons that all matter here: these
 * pick up `currentColor` and the church's own brand tokens, they animate
 * without shipping a canvas library, and there is no second network request
 * before the first screen of onboarding paints.
 *
 * Every gradient, filter, and mask id is generated with `useId()`. SVG ids are
 * document-global, so two of these on one page with hard-coded ids would have
 * the second silently repaint the first — which is exactly what happens on the
 * wizard, where several of these render together.
 *
 * All of it is decorative: `aria-hidden`, never focusable, and every animation
 * is dropped under `prefers-reduced-motion` by the utilities in globals.css.
 */

/**
 * Slow-drifting colour field. The backdrop for a step's hero panel.
 *
 * Three offset blurred blobs rather than a CSS gradient because the movement
 * needs to be non-uniform — a single translated gradient reads as a sliding
 * sheet, while offset blobs at different periods never quite repeat.
 */
export function AuroraField({ className }: { className?: string }) {
  const id = useId();
  const blur = `${id}-blur`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
      </defs>

      <g filter={`url(#${blur})`} opacity="0.55">
        <circle cx="90" cy="90" r="80" fill="var(--brand)" className="motion-drift-a" />
        <circle cx="300" cy="70" r="70" fill="var(--accent)" className="motion-drift-b" />
        <circle cx="210" cy="230" r="90" fill="var(--brand)" opacity="0.7" className="motion-drift-c" />
      </g>
    </svg>
  );
}

/**
 * A faint engineering grid, fading out toward the bottom.
 *
 * The mask is what keeps it from reading as a spreadsheet: an un-faded grid
 * competes with the form fields sitting on top of it for the reader's eye.
 */
export function BlueprintGrid({ className }: { className?: string }) {
  const id = useId();
  const pattern = `${id}-grid`;
  const fade = `${id}-fade`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <pattern id={pattern} width="32" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M32 0H0V32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.35"
          />
        </pattern>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${fade})`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${pattern})`}
        mask={`url(#${id}-mask)`}
      />
    </svg>
  );
}

/**
 * A progress ring that reads as a percentage at a glance.
 *
 * `pathLength="100"` normalises the circumference so the dash array is just
 * the percentage — no `2πr` arithmetic that breaks the moment the radius
 * changes.
 */
export function ProgressRing({
  value,
  size = 44,
  className,
  children,
}: {
  value: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 40 40"
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
      >
        <defs>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.15"
        />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${clamped} 100`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      {children}
    </span>
  );
}

/**
 * The crew, drawn as a signal travelling along a wire.
 *
 * This is the one piece that is genuinely informational rather than
 * decorative: the lit segment is the specialist actually running, read from
 * the build's real step index, so it moves when the build moves rather than on
 * a timer. `total` is taken from `CREW_STEPS` by the caller, not hard-coded, so
 * adding a seventh agent does not silently draw six.
 */
export function CrewCircuit({
  total,
  activeIndex,
  complete,
  className,
}: {
  total: number;
  activeIndex: number;
  complete?: boolean;
  className?: string;
}) {
  const id = useId();
  const width = 320;
  const gap = width / Math.max(total - 1, 1);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} 48`}
      className={cn("w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-live`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <line
        x1="0"
        y1="24"
        x2={width}
        y2="24"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.18"
      />
      <line
        x1="0"
        y1="24"
        x2={complete ? width : gap * activeIndex}
        y2="24"
        stroke={`url(#${id}-live)`}
        strokeWidth="2"
        strokeLinecap="round"
        className="transition-[x2] duration-700 ease-out"
      />

      {Array.from({ length: total }, (_, index) => {
        const done = complete || index < activeIndex;
        const active = !complete && index === activeIndex;
        const cx = gap * index;

        return (
          <g key={index}>
            {active ? (
              <circle
                cx={cx}
                cy="24"
                r="9"
                fill="var(--accent)"
                opacity="0.25"
                className="motion-pulse"
              />
            ) : null}
            <circle
              cx={cx}
              cy="24"
              r={active ? 6 : 4.5}
              fill={
                done
                  ? "var(--brand)"
                  : active
                    ? "var(--accent)"
                    : "currentColor"
              }
              opacity={done || active ? 1 : 0.25}
              filter={active ? `url(#${id}-glow)` : undefined}
              className="transition-all duration-500"
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A soft corner flourish for panel headers — a few concentric arcs.
 *
 * Purely ornamental, and deliberately low-contrast: it sits behind a heading,
 * and anything stronger would make the heading harder to read rather than more
 * interesting.
 */
export function ArcFlourish({ className }: { className?: string }) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 120"
      className={cn("pointer-events-none absolute", className)}
    >
      <defs>
        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[34, 52, 70, 88].map((r, index) => (
        <circle
          key={r}
          cx="120"
          cy="0"
          r={r}
          fill="none"
          stroke={`url(#${id}-arc)`}
          strokeWidth={index === 1 ? 1.5 : 1}
        />
      ))}
    </svg>
  );
}
