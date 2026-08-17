import { cn } from "@/lib/utils";
import { safeMediaUrl } from "@/lib/validation/url";

function youtubeEmbedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only YouTube may be framed. Without this an arbitrary https URL from
    // section config would become an iframe on a church's homepage.
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
  } catch {
    return null;
  }
  return null;
}

/** Photography, video, or CSS atmosphere for church sections. */
export function VisualBlock({
  variant = "sanctuary",
  className,
  label,
  imageUrl: rawImageUrl,
  videoUrl,
}: {
  variant?: "sanctuary" | "community" | "worship" | "nature" | "editorial" | "minimal" | "cinematic";
  className?: string;
  label?: string;
  imageUrl?: string;
  videoUrl?: string;
}) {
  // Last line of defence: this component is the only place a config-supplied
  // image reaches an `img` tag, so it re-checks rather than trusting callers.
  const imageUrl = safeMediaUrl(rawImageUrl);

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

  const embed = videoUrl ? youtubeEmbedSrc(videoUrl) : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        variant === "minimal" && !imageUrl ? "border border-site-primary/10" : "",
        className
      )}
      style={imageUrl || embed ? undefined : { background: gradients[variant] }}
      aria-hidden={!label}
    >
      {embed ? (
        <iframe
          src={embed}
          title={label || "Church video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
        </>
      )}
      {imageUrl && !embed ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
      ) : null}
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
