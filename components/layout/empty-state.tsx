import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The product's one empty state.
 *
 * Every screen previously wrote its own centred div, so "no events yet" looked
 * different from "no website yet" and neither said what to do next. An empty
 * state is the first thing a new church sees on most screens, so it gets a
 * quiet icon, one sentence of orientation, and the action that resolves it.
 *
 * Deliberately compact. An empty state is a placeholder, not a feature: making
 * it tall is how a dashboard ends up looking emptier the less content it has.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card
      variant="dashed"
      padding="none"
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-5 py-6" : "px-6 py-10",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-muted shadow-[var(--shadow-soft)]">
          <Icon className="size-4" />
        </span>
      ) : null}
      <h2
        className={cn(
          "text-sm font-semibold text-foreground text-balance",
          Icon ? "mt-3" : ""
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </Card>
  );
}
