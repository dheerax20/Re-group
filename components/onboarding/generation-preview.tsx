"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import type { SiteConfig } from "@/lib/site/types";
import { cn } from "@/lib/utils";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORTS: Record<Viewport, { width: number; label: string }> = {
  desktop: { width: 1100, label: "Desktop" },
  tablet: { width: 768, label: "Tablet" },
  mobile: { width: 390, label: "Mobile" },
};

export function GenerationPreview({ site }: { site: SiteConfig }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const width = VIEWPORTS[viewport].width;

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-editor-panel shadow-[var(--shadow-lift)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <p className="text-xs text-white/55">Live AI preview</p>
        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
          {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => {
            const Icon = key === "desktop" ? Monitor : key === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewport(key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-white/50",
                  viewport === key && "bg-accent text-editor-shell"
                )}
              >
                <Icon className="size-3.5" />
                {VIEWPORTS[key].label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex max-h-[68vh] justify-center overflow-auto bg-editor-shell p-4">
        <div
          className={cn(
            "overflow-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-[width,border-radius] duration-300",
            viewport === "mobile"
              ? "rounded-[1.5rem] border-[8px] border-editor-border"
              : viewport === "tablet"
                ? "rounded-panel border-[6px] border-editor-border"
                : "w-full max-w-[1100px] rounded-xl"
          )}
          style={{ width: "100%", maxWidth: width }}
        >
          <ThemeProvider brand={site.brand}>
            <BlockTree nodes={site.blocks} site={site} content={{ sermons: [], events: [] }} />
          </ThemeProvider>
        </div>
      </div>
    </div>
  );
}
