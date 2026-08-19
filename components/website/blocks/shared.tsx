import { cn } from "@/lib/utils";

/**
 * The small presentational pieces the block renderer shares.
 *
 * These used to live in `components/website/sections/`, alongside the fixed
 * per-section components (hero.tsx, sermons.tsx, …) that the AI block tree
 * replaced. That folder is gone; these three survived it because they are the
 * only parts that were never about a specific section — they render a data
 * block that has nothing to show, an eyebrow in one of the art direction's
 * accent treatments, and a stat chip.
 */

/** Placeholder for a data-bound block whose collection is empty. */
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

/**
 * An eyebrow in one of the four accent treatments the art direction can pick
 * (`none`, `line`, `bordered`, `numbered`) — this is a big part of why two
 * builds on the same direction don't read as the same page.
 */
export function TraitEyebrow({
  children,
  accent,
  tone = "default",
}: {
  children: React.ReactNode;
  accent?: "none" | "line" | "bordered" | "numbered";
  tone?: "default" | "light";
}) {
  const base = "text-sm font-semibold uppercase tracking-wider";
  const color = tone === "light" ? "text-white" : "text-site-accent";

  if (accent === "bordered") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1",
          base,
          color,
          tone === "light" ? "border-white/30" : "border-site-accent/30"
        )}
      >
        {children}
      </span>
    );
  }

  if (accent === "numbered") {
    return (
      <span className={cn("inline-flex items-center gap-2", base, color)}>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
            tone === "light" ? "bg-white/15" : "bg-site-accent/15"
          )}
        >
          •
        </span>
        {children}
      </span>
    );
  }

  return (
    <div className="inline-block">
      <p className={cn(base, color)}>{children}</p>
      {accent === "line" ? (
        <span
          className={cn(
            "mt-2 block h-0.5 w-10 rounded-full",
            tone === "light" ? "bg-white/60" : "bg-site-accent/60"
          )}
        />
      ) : null}
    </div>
  );
}

/** A single label/value chip from a `stats` block. */
export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
