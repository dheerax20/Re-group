import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  change,
  className,
}: {
  label: string;
  value: string;
  change?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {change ? (
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            {change}
          </span>
        ) : null}
      </div>
    </div>
  );
}
