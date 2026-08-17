"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers3,
  Link2,
  ListChecks,
  Monitor,
  Save,
  Smartphone,
  Tablet,
  Grid3x3,
} from "lucide-react";
import type { NavigationItem, SectionInstance, SiteConfig, SiteContent } from "@/lib/site/types";
import { updateSections } from "@/lib/site/actions";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";
import { variantsFor } from "@/components/website/renderer/section-registry";
import { sectionTypeLabels } from "@/lib/site/section-variants";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PagesLinker } from "@/components/builder/pages-linker";
import { EditorImprovePanel } from "@/components/builder/editor-improve-panel";
import { countOpenNeeds, buildEditorNeeds } from "@/lib/builder/checklist";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Viewport = "desktop" | "tablet" | "mobile";
type LeftTab = "layers" | "pages" | "improve";

const VIEWPORTS: Record<Viewport, { width: number; label: string }> = {
  desktop: { width: 1280, label: "Desktop" },
  tablet: { width: 768, label: "Tablet" },
  mobile: { width: 390, label: "Mobile" },
};

function ctaFromConfig(config: Record<string, unknown>) {
  const cta = config.primaryCta as { label?: string; href?: string } | undefined;
  return { label: cta?.label ?? "", href: cta?.href ?? "" };
}

export function VisualEditor({
  site,
  content,
}: {
  site: SiteConfig;
  content: SiteContent;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<SectionInstance[]>(site.sections);
  const [navigation, setNavigation] = useState<NavigationItem[]>(site.navigation);
  const [selectedId, setSelectedId] = useState(site.sections[0]?.id ?? "");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [showGrid, setShowGrid] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [mobilePanel, setMobilePanel] = useState<"layers" | "inspector" | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [meta, setMeta] = useState({
    improvements: site.improvements ?? [],
    designFeedback: site.designFeedback ?? [],
    mobileFeedback: site.mobileFeedback ?? [],
  });

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const previewSite = useMemo(
    () => ({
      ...site,
      sections,
      navigation,
      improvements: meta.improvements,
      designFeedback: meta.designFeedback,
      mobileFeedback: meta.mobileFeedback,
    }),
    [site, sections, navigation, meta]
  );
  const openNeeds = useMemo(
    () => countOpenNeeds(buildEditorNeeds(previewSite, sections)),
    [previewSite, sections]
  );
  const frameWidth = VIEWPORTS[viewport].width;

  function patchSelected(patch: Partial<SectionInstance>) {
    if (!selected) return;
    setSections((current) =>
      current.map((section) =>
        section.id === selected.id ? { ...section, ...patch } : section
      )
    );
  }

  function patchConfig(key: string, value: string) {
    if (!selected) return;
    patchSelected({ config: { ...selected.config, [key]: value } });
  }

  function patchCta(field: "label" | "href", value: string) {
    if (!selected) return;
    const current = ctaFromConfig(selected.config);
    patchSelected({
      config: { ...selected.config, primaryCta: { ...current, [field]: value } },
    });
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    setSections((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function save() {
    startTransition(async () => {
      await updateSections(site.site.id, sections);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    });
  }

  const layersList = (
    <ul className="space-y-0.5 px-2 pb-4">
      {sections.map((section, index) => {
        const active = section.id === selected?.id;
        return (
          <li key={section.id}>
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-lg px-1",
                active && "bg-white/10"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedId(section.id);
                  setMobilePanel(null);
                }}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px]"
              >
                {sectionTypeLabels[section.type] ?? section.type}
              </button>
              <button
                type="button"
                onClick={() =>
                  setSections((current) =>
                    current.map((item) =>
                      item.id === section.id ? { ...item, enabled: !item.enabled } : item
                    )
                  )
                }
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label={section.enabled ? "Hide section" : "Show section"}
              >
                {section.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => move(index, -1)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Move up"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Move down"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const inspector = selected ? (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Inspector
        </p>
        <h2 className="mt-1 text-base font-semibold">
          {sectionTypeLabels[selected.type] ?? selected.type}
        </h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="variant">Variant</Label>
        <NativeSelect
          id="variant"
          value={selected.variant}
          onChange={(e) => patchSelected({ variant: e.target.value })}
        >
          {variantsFor(selected.type).map((variant) => (
            <option key={variant} value={variant}>
              {variant}
            </option>
          ))}
        </NativeSelect>
      </div>
      {["eyebrow", "title"].map((key) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={key} className="capitalize">
            {key}
          </Label>
          <Input
            id={key}
            value={String(selected.config[key] ?? "")}
            onChange={(e) => patchConfig(key, e.target.value)}
          />
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={String(selected.config.description ?? "")}
          onChange={(e) => patchConfig("description", e.target.value)}
        />
      </div>
      {selected.type === "hero" || selected.type === "cta" ? (
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="cta-label">Button label</Label>
            <Input
              id="cta-label"
              value={ctaFromConfig(selected.config).label}
              onChange={(e) => patchCta("label", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta-href">Button page</Label>
            <NativeSelect
              id="cta-href"
              value={ctaFromConfig(selected.config).href}
              onChange={(e) => patchCta("href", e.target.value)}
            >
              <option value="">Choose a page</option>
              {navigation.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label} ({item.href})
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      ) : null}
      {["hero", "welcome", "about", "cta"].includes(selected.type) ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Media
          </p>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              placeholder="https://…"
              value={String(selected.config.imageUrl ?? "")}
              onChange={(e) => patchConfig("imageUrl", e.target.value)}
            />
          </div>
          {selected.type === "hero" || selected.type === "welcome" ? (
            <div className="space-y-2">
              <Label htmlFor="videoUrl">Video URL (YouTube)</Label>
              <Input
                id="videoUrl"
                placeholder="https://youtube.com/watch?v=…"
                value={String(selected.config.videoUrl ?? "")}
                onChange={(e) => patchConfig("videoUrl", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">Select a section to edit.</p>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-editor-panel text-editor-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-editor-border bg-editor-shell px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-editor-foreground transition-colors hover:bg-white/10"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Website builder
            </p>
            <p className="truncate text-sm font-medium text-editor-foreground">{site.site.name}</p>
          </div>
        </div>

        <div className="hidden items-center rounded-xl border border-white/10 bg-white/5 p-0.5 md:flex">
          {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => {
            const Icon = key === "desktop" ? Monitor : key === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewport(key)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg text-white/50",
                  viewport === key && "bg-accent text-editor-shell"
                )}
                aria-label={VIEWPORTS[key].label}
                title={VIEWPORTS[key].label}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowGrid((value) => !value)}
            className={cn(
              "ml-0.5 inline-flex size-8 items-center justify-center rounded-lg text-white/50",
              showGrid && "bg-white/10 text-accent"
            )}
            aria-pressed={showGrid}
            aria-label="Toggle grid"
          >
            <Grid3x3 className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {saved ? <span className="hidden text-xs text-success sm:inline">Saved</span> : null}
          {isPending ? (
            <span className="hidden text-xs text-white/50 sm:inline">Saving…</span>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={isPending}
            className="h-8 bg-accent text-editor-shell hover:bg-accent/90"
          >
            <Save className="size-3.5" />
            {isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-editor-border bg-editor-shell px-2 py-1.5 md:hidden">
        {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => {
          const Icon = key === "desktop" ? Monitor : key === "tablet" ? Tablet : Smartphone;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setViewport(key)}
              className={cn(
                "inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                viewport === key
                  ? "bg-accent text-editor-shell"
                  : "bg-white/5 text-white/60"
              )}
            >
              <Icon className="size-3.5" />
              {VIEWPORTS[key].label}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="hidden min-h-0 flex-col overflow-hidden border-r border-editor-border bg-editor-shell lg:flex">
          <div className="flex gap-1 border-b border-editor-border p-2">
            <button
              type="button"
              onClick={() => setLeftTab("layers")}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                leftTab === "layers"
                  ? "bg-white/10 text-accent"
                  : "text-white/50 hover:bg-white/5"
              )}
            >
              <Layers3 className="size-3.5" />
              Layers
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("pages")}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                leftTab === "pages"
                  ? "bg-white/10 text-accent"
                  : "text-white/50 hover:bg-white/5"
              )}
            >
              <Link2 className="size-3.5" />
              Pages
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("improve")}
              className={cn(
                "relative flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                leftTab === "improve"
                  ? "bg-white/10 text-accent"
                  : "text-white/50 hover:bg-white/5"
              )}
            >
              <ListChecks className="size-3.5" />
              Needs
              {openNeeds > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-editor-shell">
                  {openNeeds > 9 ? "9+" : openNeeds}
                </span>
              ) : null}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto text-editor-foreground">
            {leftTab === "layers" ? (
              layersList
            ) : leftTab === "pages" ? (
              <div className="p-3 [&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:text-white [&_label]:text-white/70 [&_p]:text-white/50 [&_select]:border-white/15 [&_select]:bg-white/5 [&_select]:text-white">
                <PagesLinker
                  compact
                  siteId={site.site.id}
                  features={site.features}
                  initialNavigation={navigation}
                  onChange={setNavigation}
                />
              </div>
            ) : (
              <EditorImprovePanel
                site={previewSite}
                sections={sections}
                onSelectSection={(id) => {
                  setSelectedId(id);
                  setLeftTab("layers");
                }}
                onApplied={(result) => {
                  setSections(result.sections);
                  setMeta({
                    improvements: result.improvements,
                    designFeedback: result.designFeedback,
                    mobileFeedback: result.mobileFeedback,
                  });
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1800);
                  router.refresh();
                }}
              />
            )}
          </div>
        </aside>

        <div
          className={cn(
            "relative min-h-0 overflow-auto p-3 sm:p-5",
            showGrid ? "regroup-grid bg-editor-shell" : "bg-editor-shell"
          )}
        >
          {isPending ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-white/10">
              <div className="h-full w-1/3 animate-pulse bg-accent" />
            </div>
          ) : null}
          <div className="mx-auto flex min-h-full justify-center">
            <div
              className={cn(
                "relative overflow-hidden bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-[width,border-radius] duration-300",
                viewport === "mobile"
                  ? "rounded-[1.75rem] border-[10px] border-editor-border"
                  : viewport === "tablet"
                    ? "rounded-2xl border-[8px] border-editor-border"
                    : "w-full max-w-[1100px] rounded-2xl"
              )}
              style={
                viewport === "desktop"
                  ? undefined
                  : { width: "100%", maxWidth: frameWidth }
              }
            >
              {isPending ? (
                <div className="absolute inset-0 z-20 bg-white/45 backdrop-blur-[1px]">
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-10 w-2/3 bg-border" />
                    <Skeleton className="h-40 w-full bg-border" />
                    <Skeleton className="h-24 w-full bg-border" />
                  </div>
                </div>
              ) : null}
              <ThemeProvider brand={previewSite.brand}>
                <WebsiteRenderer
                  site={previewSite}
                  content={content}
                  editor={{ selectedId: selected?.id ?? "", onSelect: setSelectedId }}
                />
              </ThemeProvider>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-editor-border bg-editor-shell p-4 text-editor-foreground lg:block [&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:text-white [&_label]:text-white/70 [&_select]:border-white/15 [&_select]:bg-white/5 [&_select]:text-white [&_textarea]:border-white/15 [&_textarea]:bg-white/5 [&_textarea]:text-white">
          {inspector}
        </aside>
      </div>

      <div className="flex items-center gap-2 border-t border-editor-border bg-editor-shell p-2 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => setMobilePanel("layers")}
        >
          <Layers3 className="size-3.5" />
          Structure
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => {
            setLeftTab("improve");
            setMobilePanel("layers");
          }}
        >
          <ListChecks className="size-3.5" />
          Needs{openNeeds > 0 ? ` (${openNeeds})` : ""}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => setMobilePanel("inspector")}
        >
          Edit
        </Button>
      </div>

      <Sheet open={mobilePanel !== null} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl bg-editor-shell text-editor-foreground">
          <SheetHeader>
            <SheetTitle className="text-editor-foreground">
              {mobilePanel === "inspector"
                ? "Inspector"
                : leftTab === "improve"
                  ? "Needs & AI"
                  : "Website structure"}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {mobilePanel === "inspector" ? (
              inspector
            ) : leftTab === "improve" ? (
              <div className="min-h-[50vh]">
                <EditorImprovePanel
                  site={previewSite}
                  sections={sections}
                  onSelectSection={(id) => {
                    setSelectedId(id);
                    setMobilePanel("inspector");
                  }}
                  onApplied={(result) => {
                    setSections(result.sections);
                    setMeta({
                      improvements: result.improvements,
                      designFeedback: result.designFeedback,
                      mobileFeedback: result.mobileFeedback,
                    });
                    setMobilePanel(null);
                    router.refresh();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setLeftTab("layers")}
                    className={cn(
                      "h-8 flex-1 rounded-lg text-xs",
                      leftTab === "layers" ? "bg-white/10 text-accent" : "text-white/50"
                    )}
                  >
                    Layers
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("pages")}
                    className={cn(
                      "h-8 flex-1 rounded-lg text-xs",
                      leftTab === "pages" ? "bg-white/10 text-accent" : "text-white/50"
                    )}
                  >
                    Pages
                  </button>
                </div>
                {leftTab === "pages" ? (
                  <PagesLinker
                    compact
                    siteId={site.site.id}
                    features={site.features}
                    initialNavigation={navigation}
                    onChange={setNavigation}
                  />
                ) : (
                  layersList
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
