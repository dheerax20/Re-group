"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  LayoutDashboard,
  Save,
} from "lucide-react";
import type { SectionInstance, SiteConfig, SiteContent } from "@/lib/site/types";
import { updateSections } from "@/lib/site/actions";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";
import { variantsFor } from "@/components/website/renderer/section-registry";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VisualEditor({
  site,
  content,
}: {
  site: SiteConfig;
  content: SiteContent;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<SectionInstance[]>(site.sections);
  const [selectedId, setSelectedId] = useState(site.sections[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const previewSite = useMemo(() => ({ ...site, sections }), [site, sections]);

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#141211] text-[#f4efe8]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[#c67139]">
            Website builder
          </p>
          <p className="truncate text-sm font-medium">{site.site.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved ? <span className="text-xs text-emerald-400">Saved</span> : null}
          <Link
            href={`/dashboard?siteId=${site.site.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-white/70 hover:bg-white/8 hover:text-white"
          >
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </Link>
          {site.site.status === "PUBLISHED" ? (
            <Link
              href={`/sites/${site.site.slug}`}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-white/70 hover:bg-white/8"
            >
              Live
            </Link>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={isPending}
            className="h-8 bg-[#c67139] text-white hover:bg-[#c67139]/90"
          >
            <Save className="mr-1.5 size-3.5" />
            {isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-white/8 lg:block">
          <p className="px-3 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Layers
          </p>
          <ul className="space-y-0.5 px-2 pb-4">
            {sections.map((section, index) => {
              const active = section.id === selected?.id;
              return (
                <li key={section.id}>
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-1",
                      active && "bg-white/8"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(section.id)}
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px] capitalize"
                    >
                      {section.type}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSections((current) =>
                          current.map((item) =>
                            item.id === section.id
                              ? { ...item, enabled: !item.enabled }
                              : item
                          )
                        )
                      }
                      className="p-1 text-white/40 hover:text-white"
                      aria-label={section.enabled ? "Hide section" : "Show section"}
                    >
                      {section.enabled ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      className="p-1 text-white/40 hover:text-white"
                      aria-label="Move up"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      className="p-1 text-white/40 hover:text-white"
                      aria-label="Move down"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-h-0 overflow-auto bg-[#201e1d] p-4 sm:p-6">
          <div className="mx-auto min-h-full max-w-[1100px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <ThemeProvider brand={previewSite.brand}>
              <WebsiteRenderer site={previewSite} content={content} />
            </ThemeProvider>
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-white/8 p-4 lg:block">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Inspector
                </p>
                <h2 className="mt-1 capitalize">{selected.type}</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant" className="text-white/70">
                  Variant
                </Label>
                <NativeSelect
                  id="variant"
                  value={selected.variant}
                  onChange={(e) => patchSelected({ variant: e.target.value })}
                  className="border-white/15 bg-white/5 text-white"
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
                  <Label htmlFor={key} className="capitalize text-white/70">
                    {key}
                  </Label>
                  <Input
                    id={key}
                    value={String(selected.config[key] ?? "")}
                    onChange={(e) => patchConfig(key, e.target.value)}
                    className="border-white/15 bg-white/5 text-white"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white/70">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={String(selected.config.description ?? "")}
                  onChange={(e) => patchConfig("description", e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/50">Select a section to edit.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
