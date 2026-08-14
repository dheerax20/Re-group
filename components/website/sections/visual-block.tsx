import { cn } from "@/lib/utils";

/** CSS-only atmospheric media — no uploads required. */
export function VisualBlock({
  variant = "sanctuary",
  className,
  label,
}: {
  variant?: "sanctuary" | "community" | "worship" | "nature" | "editorial" | "minimal" | "cinematic";
  className?: string;
  label?: string;
}) {
  const gradients: Record<string, string> = {
    sanctuary:
      "linear-gradient(145deg, color-mix(in oklab, var(--color-primary) 92%, black), color-mix(in oklab, var(--color-secondary) 70%, var(--color-accent)), var(--color-accent))",
    community:
      "linear-gradient(160deg, color-mix(in oklab, var(--color-primary) 80%, white), var(--color-accent))",
    worship:
      "radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--color-accent) 55%, white), transparent 50%), linear-gradient(135deg, var(--color-primary), color-mix(in oklab, var(--color-primary) 60%, black))",
    nature:
      "linear-gradient(180deg, color-mix(in oklab, var(--color-secondary) 40%, white), var(--color-primary))",
    editorial:
      "linear-gradient(120deg, color-mix(in oklab, var(--color-foreground) 88%, var(--color-primary)), var(--color-primary))",
    cinematic:
      "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--color-accent) 38%, transparent), transparent 42%), radial-gradient(ellipse at 80% 80%, color-mix(in oklab, var(--color-secondary) 28%, transparent), transparent 40%), linear-gradient(165deg, var(--color-primary), color-mix(in oklab, var(--color-primary) 70%, black))",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        variant === "minimal" ? "border border-site-primary/10" : "",
        className
      )}
      style={{ background: gradients[variant] }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
      {label ? (
        <div className="absolute bottom-4 left-4 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {label}
        </div>
      ) : null}
    </div>
  );
}

export function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
