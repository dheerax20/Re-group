"use client";

import { Check } from "lucide-react";
import { fontKeyToCssVar } from "@/lib/theme/font-registry";
import type { BrandCombination } from "@/lib/theme/brand-combinations";
import { cn } from "@/lib/utils";

/**
 * A horizontal row of preset color + font pairings.
 *
 * Scroll-snap on a plain `overflow-x-auto` div rather than a carousel
 * library or the shared `ScrollArea`: Radix's `ScrollArea` sets
 * `overflow-x: hidden` inline unless a horizontal `ScrollBar` sibling has
 * mounted, which the shared component never does — every other
 * horizontal-scroll spot in this repo (`table.tsx`, `tabs.tsx`,
 * `step-progress.tsx`) already works around that the same way.
 */
export function BrandCombinationCarousel({
  combinations,
  activeId,
  onSelect,
}: {
  combinations: BrandCombination[];
  activeId: string | null;
  onSelect: (combo: BrandCombination) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3">
      {combinations.map((combo) => {
        const isActive = combo.id === activeId;
        return (
          <button
            key={combo.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(combo)}
            className={cn(
              "relative flex w-[190px] shrink-0 snap-start flex-col gap-3 rounded-panel border bg-surface p-4 text-left shadow-[var(--shadow-soft)] transition-colors",
              isActive ? "border-brand" : "border-border hover:border-border-strong"
            )}
          >
            {isActive ? (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[11px] font-medium text-brand-foreground">
                <Check className="size-3" />
                Applied
              </span>
            ) : null}
            <div className="flex gap-2">
              <span
                className="size-9 rounded-full border border-border"
                style={{ backgroundColor: combo.colors.primary }}
              />
              <span
                className="size-9 rounded-full border border-border"
                style={{ backgroundColor: combo.colors.secondary }}
              />
            </div>
            <div>
              <p
                className="text-lg font-semibold leading-tight"
                style={{ fontFamily: fontKeyToCssVar(combo.typography.primaryFont) }}
              >
                Primary Font
              </p>
              <p
                className="text-sm text-muted"
                style={{ fontFamily: fontKeyToCssVar(combo.typography.secondaryFont) }}
              >
                Secondary Font
              </p>
            </div>
            <p className="text-[11px] uppercase tracking-wide text-muted">{combo.name}</p>
          </button>
        );
      })}
    </div>
  );
}
