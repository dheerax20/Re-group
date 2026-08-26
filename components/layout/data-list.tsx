import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The product's list surface — pages, events, sermons, domains, integrations.
 *
 * One bordered container with hairline-divided rows, rather than a card per
 * item. A church's content is a *list of similar things*; giving each one its
 * own floating panel was what made three events fill a whole screen and read
 * as three unrelated announcements.
 *
 * Rows stack on a phone (`sm:` unlocks the horizontal layout) and never force
 * the page to scroll sideways.
 */
export function DataList({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="data-list"
      className={cn(
        "divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)]",
        className
      )}
      {...props}
    />
  );
}

export function DataListRow({
  leading,
  title,
  meta,
  description,
  trailing,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "title"> & {
  /** Icon or avatar. Hidden from assistive tech — it repeats the title. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** The one line of supporting detail: a date, a path, a speaker. */
  meta?: React.ReactNode;
  description?: React.ReactNode;
  /** Status, shown before the actions on wide screens. */
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-3.5 py-3 transition-colors hover:bg-surface-muted/40 sm:flex-row sm:items-center sm:gap-4",
        className
      )}
      {...props}
    >
      {leading ? (
        <span aria-hidden className="flex shrink-0 items-center">
          {leading}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] font-medium text-foreground">{title}</span>
          {meta ? (
            <span className="truncate text-[13px] text-muted">{meta}</span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 truncate text-[13px] text-muted">{description}</p>
        ) : null}
      </div>

      {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </li>
  );
}

/**
 * The icon chip that leads a row. Neutral by default — colour on a list icon
 * is reserved for state that matters (a domain that is working, a page that is
 * hidden).
 */
export function RowIcon({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-muted text-muted",
    brand: "bg-brand-soft text-brand-strong",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  } as const;

  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-lg [&_svg]:size-4",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
