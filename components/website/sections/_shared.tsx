import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wider text-site-accent">
      {children}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-dashed border-site-muted/25">
      <div
        className="h-28"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 18%, white), color-mix(in oklab, var(--color-accent) 25%, white))",
        }}
      />
      <div className="p-8 text-center text-site-muted">{message}</div>
    </div>
  );
}

export function cfgString(
  config: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
