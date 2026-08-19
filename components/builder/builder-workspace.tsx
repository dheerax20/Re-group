"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Monitor, Smartphone, Sparkles } from "lucide-react";
import type { SiteConfig, SiteContent, NavigationItem } from "@/lib/site/types";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID } from "@/lib/site/blocks/types";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PagesLinker } from "@/components/builder/pages-linker";
import { SiteChatPanel } from "@/components/builder/site-chat-panel";
import { PublishBar } from "@/components/builder/publish-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "assistant" | "pages";

/**
 * The website editor.
 *
 * This replaced a ~650-line section-by-section visual editor that edited
 * `sectionConfig` — a shape nothing renders any more. Every public page walks
 * the AI-composed block tree (`site.blocks`), so an editor built on section
 * instances was editing a column the renderer had stopped reading.
 *
 * What's here now is deliberately narrow: a true-to-final preview of the real
 * block tree, the navigation editor, and the AI assistant. Direct
 * block-by-block editing is not built yet — until it is, structural changes
 * come from rebuilding the site with the crew.
 */
export function BuilderWorkspace({
  site,
  content,
}: {
  site: SiteConfig;
  content: SiteContent;
}) {
  const [tab, setTab] = useState<Tab>("assistant");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [navigation, setNavigation] = useState<NavigationItem[]>(site.navigation);

  // nav and footer are pinned bands; the preview renders the tree exactly as
  // the public page does, so what the church sees here is what ships.
  const pageBlocks = site.blocks.filter(
    (block) => block.id !== NAV_BLOCK_ID && block.id !== FOOTER_BLOCK_ID
  );
  const navBlock = site.blocks.find((block) => block.id === NAV_BLOCK_ID);
  const footerBlock = site.blocks.find((block) => block.id === FOOTER_BLOCK_ID);

  const previewSite = { ...site, navigation };

  return (
    <div className="flex h-full min-h-0 flex-col bg-editor-shell text-editor-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-editor-border px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{site.site.name}</p>
          <p className="truncate text-xs text-editor-muted">/{site.site.slug}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-editor-border p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              aria-label="Desktop preview"
              aria-pressed={device === "desktop"}
              className={cn(
                "rounded-md p-1.5",
                device === "desktop" ? "bg-white/10" : "text-editor-muted"
              )}
            >
              <Monitor className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              aria-label="Mobile preview"
              aria-pressed={device === "mobile"}
              className={cn(
                "rounded-md p-1.5",
                device === "mobile" ? "bg-white/10" : "text-editor-muted"
              )}
            >
              <Smartphone className="size-4" />
            </button>
          </div>

          <Link href={`/sites/${site.site.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4" />
              View site
            </Button>
          </Link>

          <PublishBar
            siteId={site.site.id}
            slug={site.site.slug}
            status={site.site.status}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[22rem_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-editor-border lg:border-b-0 lg:border-r">
          <div className="flex border-b border-editor-border">
            {(["assistant", "pages"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 px-3 py-2 text-sm capitalize",
                  tab === value
                    ? "border-b-2 border-white/60 font-medium"
                    : "text-editor-muted"
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "assistant" ? (
              <SiteChatPanel siteId={site.site.id} onApplied={() => {}} />
            ) : (
              <div className="p-3 [&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:text-white [&_label]:text-white/70 [&_p]:text-white/50 [&_select]:border-white/15 [&_select]:bg-white/5 [&_select]:text-white">
                <PagesLinker
                  compact
                  siteId={site.site.id}
                  features={site.features}
                  initialNavigation={navigation}
                  onChange={setNavigation}
                />
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 border-t border-editor-border p-3 text-xs text-editor-muted">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            <span>
              To change the layout itself, rebuild the site from the{" "}
              <Link href="/builder/templates" className="underline">
                website studio
              </Link>
              .
            </span>
          </p>
        </aside>

        <div className="min-h-0 overflow-y-auto bg-neutral-200 p-4 dark:bg-neutral-900">
          <div
            className={cn(
              "mx-auto overflow-hidden rounded-xl bg-white shadow-lg",
              device === "mobile" ? "w-[390px] max-w-full" : "w-full"
            )}
          >
            <ThemeProvider brand={previewSite.brand}>
              {navBlock ? (
                <BlockTree nodes={[navBlock]} site={previewSite} content={content} />
              ) : null}
              <BlockTree nodes={pageBlocks} site={previewSite} content={content} />
              {footerBlock ? (
                <BlockTree nodes={[footerBlock]} site={previewSite} content={content} />
              ) : null}
            </ThemeProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
