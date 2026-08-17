"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A read-only value with a copy button.
 *
 * Built for DNS records, where a mistyped character means a domain silently
 * never connects — so the value is monospace, selectable, and copyable, and the
 * confirmation is visible rather than a toast the user might miss.
 */
export function CopyField({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked in some embedded contexts. The value is selectable,
      // so there is still a way through — just no confirmation to show.
      setCopied(false);
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
      ) : null}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background pl-2.5">
        <code className="min-w-0 flex-1 truncate py-2 font-mono text-xs text-foreground">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? `Copied ${label ?? "value"}` : `Copy ${label ?? "value"}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
