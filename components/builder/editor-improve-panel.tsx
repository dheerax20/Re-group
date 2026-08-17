"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  Circle,
  ListChecks,
  Smartphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";
import type { SectionInstance, SiteConfig } from "@/lib/site/types";
import {
  buildEditorNeeds,
  countOpenNeeds,
  type EditorNeed,
  type EditorNeedCategory,
} from "@/lib/builder/checklist";
import { applyWebsiteAiPrompt } from "@/lib/site/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<EditorNeedCategory, string> = {
  media: "Photos & media",
  content: "Content",
  mobile: "Mobile",
  design: "Design",
  pages: "Pages",
};

const PROMPT_EXAMPLES = [
  "Make the hero warmer and more welcoming for first-time visitors",
  "Shorten all headlines for mobile and strengthen the visit CTA",
  "More traditional tone — less trendy language",
];

type ImproveTab = "needs" | "ai";

export function EditorImprovePanel({
  site,
  sections,
  onSelectSection,
  onApplied,
}: {
  site: SiteConfig;
  sections: SectionInstance[];
  onSelectSection: (sectionId: string, sectionType?: string) => void;
  onApplied: (result: {
    sections: SectionInstance[];
    improvements: SiteImprovement[];
    designFeedback: DesignFeedback[];
    mobileFeedback: DesignFeedback[];
    summary: string;
  }) => void;
}) {
  const [tab, setTab] = useState<ImproveTab>("needs");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const liveSite = useMemo(
    () => ({
      ...site,
      sections,
    }),
    [site, sections]
  );

  const needs = useMemo(() => buildEditorNeeds(liveSite, sections), [liveSite, sections]);
  const openCount = countOpenNeeds(needs);

  const grouped = useMemo(() => {
    const map = new Map<EditorNeedCategory, EditorNeed[]>();
    for (const need of needs) {
      const list = map.get(need.category) ?? [];
      list.push(need);
      map.set(need.category, list);
    }
    return map;
  }, [needs]);

  function focusNeed(need: EditorNeed) {
    if (!need.sectionType) return;
    const match = sections.find((s) => s.type === need.sectionType);
    if (match) onSelectSection(match.id, need.sectionType);
  }

  function runPrompt(text?: string) {
    const value = (text ?? prompt).trim();
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const result = await applyWebsiteAiPrompt(site.site.id, value, sections);
        setSummary(result.summary);
        setPrompt("");
        onApplied({
          sections: result.sections,
          improvements: result.improvements,
          designFeedback: result.designFeedback,
          mobileFeedback: result.mobileFeedback,
          summary: result.summary,
        });
        setTab("needs");
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI prompt failed");
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b border-editor-border p-2">
        <button
          type="button"
          onClick={() => setTab("needs")}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium",
            tab === "needs" ? "bg-white/10 text-accent" : "text-white/50 hover:bg-white/5"
          )}
        >
          <ListChecks className="size-3.5" />
          Needs
          {openCount > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-editor-shell">
              {openCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab("ai")}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium",
            tab === "ai" ? "bg-white/10 text-accent" : "text-white/50 hover:bg-white/5"
          )}
        >
          <Wand2 className="size-3.5" />
          AI prompt
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "needs" ? (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Cover everything
              </p>
              <p className="mt-1 text-xs text-white/55">
                Photos, content, mobile, and design — tap a media item to jump to that section.
              </p>
            </div>

            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  {category === "media" ? (
                    <Camera className="size-3" />
                  ) : category === "mobile" ? (
                    <Smartphone className="size-3" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  {CATEGORY_LABEL[category]}
                </p>
                <ul className="space-y-1.5">
                  {items.map((need) => (
                    <li key={need.id}>
                      <button
                        type="button"
                        onClick={() => focusNeed(need)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                          need.done
                            ? "border-success/20 bg-success/5"
                            : "border-white/10 bg-white/5 hover:border-accent/40"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {need.done ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                          ) : (
                            <Circle className="mt-0.5 size-3.5 shrink-0 text-accent" />
                          )}
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-tight">
                              {need.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                              {need.detail}
                            </span>
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                AI prompt
              </p>
              <p className="mt-1 text-xs text-white/55">
                Describe changes in plain language. AI updates copy & layout notes — you still add
                real photos.
              </p>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Make copy warmer for young families, keep traditional tone…"
              className="min-h-28 border-white/15 bg-white/5 text-sm text-white placeholder:text-white/35"
              maxLength={1200}
            />
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60 hover:border-accent/40 hover:text-accent"
                >
                  {example.slice(0, 42)}…
                </button>
              ))}
            </div>
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            {summary ? (
              <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                {summary}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending || prompt.trim().length < 8}
              onClick={() => runPrompt()}
              className="w-full bg-accent text-editor-shell hover:bg-accent/90"
            >
              <Wand2 className="size-3.5" />
              {pending ? "Applying…" : "Apply AI prompt"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
