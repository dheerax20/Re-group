import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The frames the product screenshots sit in.
 *
 * The page sells the product through its own UI rather than through
 * illustration, so these two wrappers carry all the "this is a real screen"
 * signal — a browser chrome with a plausible address bar, and a phone shell
 * with a notch. Everything inside them is the actual component language used in
 * the dashboard (same radii, same borders, same type scale), just rendered at
 * marketing scale.
 */

export function BrowserFrame({
  url,
  children,
  className,
  bodyClassName,
  label,
}: {
  /** Shown in the address bar. Keep it a church domain, never a Regroup one. */
  url: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Optional right-side status pill, e.g. "Published". */
  label?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)]",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-surface-muted/60 px-3 py-2.5">
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex min-w-0 max-w-[60%] items-center gap-1.5 rounded-md bg-surface px-2.5 py-1">
            <Lock className="size-2.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate text-[11px] text-muted">{url}</span>
          </div>
        </div>
        <div className="flex w-14 shrink-0 justify-end">{label}</div>
      </div>
      <div className={cn("bg-surface", bodyClassName)}>{children}</div>
    </div>
  );
}

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[248px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-surface shadow-[var(--shadow-lift)]",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-foreground/90"
      />
      <div className="min-h-[380px] bg-surface pt-6">{children}</div>
    </div>
  );
}

/** A small floating status card that sits over or beside a frame. */
export function FloatingCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-lift)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
