"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/**
 * The filter row that sits under a page header.
 *
 * Every control here writes to the URL rather than to component state, which is
 * what makes a filtered list linkable, shareable and survivable across a
 * refresh — and it means the server component above can do the filtering with
 * the real data instead of shipping every event to the browser to filter there.
 *
 * Writing a filter always DROPS `page`. Narrowing a search while on page 4 and
 * landing on an empty "page 4 of 1" is the single most common pagination bug,
 * and it is fixed once, here, rather than in each screen.
 */

function useQueryWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function write(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    // Any filter change resets to the first page.
    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      // `scroll: false` — retyping a search should not throw the reader back to
      // the top of a list they are half way down.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return { write, pending, searchParams };
}

export function SearchField({
  paramName = "q",
  placeholder = "Search…",
  className,
}: {
  paramName?: string;
  placeholder?: string;
  className?: string;
}) {
  const { write, pending, searchParams } = useQueryWriter();
  const fromUrl = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(fromUrl);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL is the source of truth: a back-button navigation or a cleared
  // filter has to be reflected in the box. Adjusted during render (React's
  // documented pattern for deriving state from a prop) rather than in an
  // effect, so the field never paints one frame of stale text.
  const [lastFromUrl, setLastFromUrl] = useState(fromUrl);
  if (fromUrl !== lastFromUrl) {
    setLastFromUrl(fromUrl);
    setValue(fromUrl);
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    // Debounced so a five-letter name is one navigation, not five.
    timer.current = setTimeout(() => write({ [paramName]: next.trim() || undefined }), 300);
  }

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input
        aria-label={placeholder}
        autoComplete="off"
        className="pl-9 pr-9"
        inputMode="search"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {pending ? (
        <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted" />
      ) : value ? (
        <button
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          onClick={() => {
            setValue("");
            write({ [paramName]: undefined });
          }}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  paramName,
  label,
  options,
  className,
}: {
  paramName: string;
  /** Shown as the "no filter" option, e.g. "All statuses". */
  label: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const { write, searchParams } = useQueryWriter();
  const value = searchParams.get(paramName) ?? "";

  return (
    <NativeSelect
      aria-label={label}
      className={cn("w-auto min-w-36 shrink-0", className)}
      onChange={(event) => write({ [paramName]: event.target.value || undefined })}
      value={value}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/**
 * A two-or-three-way switch: Upcoming / Past.
 *
 * A `<select>` is the wrong control for a choice this consequential — it hides
 * the alternative behind a tap, and "am I looking at past events?" is the first
 * question someone asks when a list looks empty. Segments show both states at
 * once and say which one is active.
 */
export function SegmentedFilter({
  paramName,
  options,
  className,
}: {
  paramName: string;
  /** The first option is the default and is written as an absent param. */
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const { write, searchParams } = useQueryWriter();
  const current = searchParams.get(paramName) || options[0].value;

  return (
    <div
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-muted/70 p-0.5",
        className
      )}
      role="group"
    >
      {options.map((option, index) => {
        const active = current === option.value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 items-center rounded-[7px] px-3 text-[13px] font-medium text-muted transition-colors",
              "hover:text-foreground",
              active &&
                "bg-surface text-foreground shadow-[var(--shadow-soft)] hover:text-foreground"
            )}
            key={option.value}
            onClick={() =>
              write({ [paramName]: index === 0 ? undefined : option.value })
            }
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The row itself. Scrolls horizontally on a phone rather than wrapping into
 * three stacked rows that push the content off screen.
 */
export function PageToolbar({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {actions ? (
        <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>
      ) : null}
    </div>
  );
}
