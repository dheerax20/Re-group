import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The product's one empty state.
 *
 * Every screen previously wrote its own centred div, so "no events yet" looked
 * different from "no website yet" and neither said what to do next. An empty
 * state is the first thing a new church sees on most screens, so it gets an
 * icon, one sentence of orientation, and the action that resolves it.
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
        compact ? "px-6 py-8" : "px-6 py-14",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-panel bg-brand-soft text-brand-strong">
          <Icon className="size-5" />
        </span>
      ) : null}
      <h2
        className={cn(
          "font-semibold tracking-tight text-balance",
          Icon ? "mt-4" : "",
          compact ? "text-base" : "text-lg"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </Card>
  );
}
