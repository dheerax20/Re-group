"use client";

import { useState, useTransition } from "react";
import { SectionInstance } from "@/lib/site/types";
import { sectionVariantOptions, sectionTypeLabels } from "@/lib/site/section-variants";
import { updateSections } from "@/lib/site/actions";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function SectionsEditor({
  siteId,
  initialSections,
}: {
  siteId: string;
  initialSections: SectionInstance[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function persist(next: SectionInstance[]) {
    setSections(next);
    startTransition(async () => {
      await updateSections(siteId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function toggleEnabled(id: string, enabled: boolean) {
    persist(sections.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function changeVariant(id: string, variant: string) {
    persist(sections.map((s) => (s.id === id ? { ...s, variant } : s)));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    persist(move(sections, index, target));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end text-sm text-success h-5">
        {isPending ? "Saving..." : saved ? "Saved" : ""}
      </div>
      {sections.map((section, index) => (
        <Card key={section.id}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  className="text-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                  className="text-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <div>
                <p className="font-medium text-foreground">{sectionTypeLabels[section.type]}</p>
                <p className="text-xs text-muted">{section.type}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NativeSelect
                value={section.variant}
                onChange={(e) => changeVariant(section.id, e.target.value)}
                className="w-40"
              >
                {sectionVariantOptions[section.type].map((variant) => (
                  <option key={variant} value={variant}>
                    {variant}
                  </option>
                ))}
              </NativeSelect>
              <Switch
                checked={section.enabled}
                onCheckedChange={(checked) => toggleEnabled(section.id, checked)}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="pt-2 text-xs text-muted">
        Changes save automatically. Sections tied to a disabled feature won&apos;t render even if enabled here.
      </p>
    </div>
  );
}
