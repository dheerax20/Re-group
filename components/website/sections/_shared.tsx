import { cn } from "@/lib/utils";
import { safeLinkTarget, safeMediaUrl } from "@/lib/validation/url";

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

/**
 * Reads an image or video URL out of section config.
 *
 * Section config is written by the visual editor and the AI crew and lands in
 * `src` attributes on a public page, so it is sanitized here as well as on the
 * write path — a row saved before the schemas existed still must not ship.
 * Returns undefined rather than an empty string so callers can fall back to the
 * generated CSS artwork.
 */
export function cfgMedia(
  config: Record<string, unknown>,
  key: string
): string | undefined {
  return safeMediaUrl(config[key]);
}

/** A call-to-action from section config, with both halves validated. */
export function cfgCta(
  config: Record<string, unknown>,
  key: string,
  fallback: { label: string; href: string }
): { label: string; href: string } {
  const raw = config[key];
  const cta =
    typeof raw === "object" && raw !== null
      ? (raw as { label?: unknown; href?: unknown })
      : {};

  return {
    label:
      typeof cta.label === "string" && cta.label.trim()
        ? cta.label.trim()
        : fallback.label,
    href: safeLinkTarget(cta.href, fallback.href),
  };
}
