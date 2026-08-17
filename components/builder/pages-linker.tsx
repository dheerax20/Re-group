"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Link2, Plus, Trash2 } from "lucide-react";
import type { FeatureConfig } from "@/lib/features/types";
import type { NavigationItem } from "@/lib/site/types";
import { availableSitePages } from "@/lib/site/pages";
import { updateNavigation } from "@/lib/site/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function PagesLinker({
  siteId,
  features,
  initialNavigation,
  compact = false,
  onChange,
}: {
  siteId: string;
  features: FeatureConfig;
  initialNavigation: NavigationItem[];
  compact?: boolean;
  onChange?: (items: NavigationItem[]) => void;
}) {
  const router = useRouter();
  const catalog = availableSitePages(features);
  const [items, setItems] = useState<NavigationItem[]>(initialNavigation);
  const [addHref, setAddHref] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unused = catalog.filter(
    (page) => !items.some((item) => item.href === page.href)
  );

  function persist(next: NavigationItem[]) {
    setItems(next);
    onChange?.(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateNavigation(siteId, next);
        const savedItems = result.navigation ?? next;
        setItems(savedItems);
        onChange?.(savedItems);
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save links");
      }
    });
  }

  function patchLabel(href: string, label: string) {
    persist(items.map((item) => (item.href === href ? { ...item, label } : item)));
  }

  function addPage() {
    const page = catalog.find((p) => p.href === addHref);
    if (!page) return;
    persist([...items, { href: page.href, label: page.label }]);
    setAddHref("");
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-sm font-medium", compact && "text-[11px] uppercase tracking-[0.14em] text-muted-foreground")}>
          Page links
        </p>
        <p className="text-[11px] text-muted-foreground">
          {pending ? "Saving…" : saved ? "Saved" : "Navbar + sidebar"}
        </p>
      </div>

      <ul className="space-y-1.5">
        {items.map((item, index) => {
          const locked = item.href === "/";
          return (
            <li
              key={item.href}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-1.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === 0 || pending}
                  onClick={() => persist(move(items, index, index - 1))}
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === items.length - 1 || pending}
                  onClick={() => persist(move(items, index, index + 1))}
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="sr-only" htmlFor={`nav-label-${item.href}`}>
                  Label for {item.href}
                </Label>
                <Input
                  id={`nav-label-${item.href}`}
                  value={item.label}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((row) =>
                        row.href === item.href ? { ...row, label: e.target.value } : row
                      )
                    )
                  }
                  onBlur={(e) => patchLabel(item.href, e.target.value)}
                  className="h-8 text-[13px]"
                />
                <p className="flex items-center gap-1 truncate px-0.5 text-[11px] text-muted-foreground">
                  <Link2 className="size-3 shrink-0" />
                  {item.href}
                </p>
              </div>
              <button
                type="button"
                disabled={locked || pending}
                onClick={() => persist(items.filter((row) => row.href !== item.href))}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:opacity-30"
                aria-label={`Remove ${item.label}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      {unused.length > 0 ? (
        <div className="flex gap-2">
          <NativeSelect
            value={addHref}
            onChange={(e) => setAddHref(e.target.value)}
            className="h-9 flex-1"
          >
            <option value="">Add a page…</option>
            {unused.map((page) => (
              <option key={page.href} value={page.href}>
                {page.label} ({page.href})
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!addHref || pending}
            onClick={addPage}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Every available page is already in the menu.
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
