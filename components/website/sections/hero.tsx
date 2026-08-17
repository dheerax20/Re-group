import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, cfgString, cfgCta, cfgMedia } from "./_shared";
import { buttonVariants } from "@/components/ui/button";
import { StatPill, VisualBlock } from "./visual-block";

function ctaHref(config: Record<string, unknown>): { label: string; href: string } {
  return cfgCta(config, "primaryCta", { label: "Plan Your Visit", href: "/contact" });
}

function configStats(
  config: Record<string, unknown>,
  fallback: Array<{ label: string; value: string }>
) {
  const stats = config.stats as Array<{ label?: string; value?: string }> | undefined;
  if (!Array.isArray(stats) || stats.length === 0) return fallback;
  return stats
    .filter((s) => s.label && s.value)
    .map((s) => ({ label: s.label as string, value: s.value as string }));
}

export function HeroSplit({ site, config }: SectionProps) {
  const title = cfgString(config, "title", `Welcome to ${site.site.name}`);
  const description = cfgString(
    config,
    "description",
    site.brand.tagline || "A place to belong."
  );
  const cta = ctaHref(config);
  const size =
    site.site.congregationSize && site.site.congregationSize > 0
      ? `${site.site.congregationSize}+`
      : "Growing";
  const stats = configStats(config, [
    { label: "Community", value: size },
    { label: "Gather", value: "Sundays" },
  ]);

  return (
    <section className="relative overflow-hidden bg-site-primary text-white">
      <div className="absolute inset-0">
        <VisualBlock
          variant="worship"
          className="h-full rounded-none"
          imageUrl={cfgMedia(config, "imageUrl")}
        />
      </div>
      <Container className="relative grid min-h-[620px] items-center gap-10 py-20 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-site-accent">
            {cfgString(config, "eyebrow", "Welcome")}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/80">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={cta.href}
              className={buttonVariants({
                size: "lg",
                className: "bg-white text-site-primary hover:bg-white/90",
              })}
            >
              {cta.label}
            </Link>
            <Link
              href="/about"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/30 bg-transparent text-white hover:bg-white/10",
              })}
            >
              Our story
            </Link>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatPill key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
        <VisualBlock
          variant="sanctuary"
          className="min-h-[280px] md:min-h-[420px]"
          label={site.site.name}
          imageUrl={cfgMedia(config, "imageUrl")}
          videoUrl={cfgMedia(config, "videoUrl")}
        />
      </Container>
    </section>
  );
}

export function HeroCentered({ site, config }: SectionProps) {
  const title = cfgString(config, "title", `Welcome to ${site.site.name}`);
  const description = cfgString(
    config,
    "description",
    site.brand.tagline || "A place to belong."
  );
  const cta = ctaHref(config);

  return (
    <section className="relative overflow-hidden bg-site-background py-28 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40">
        <VisualBlock variant="editorial" className="h-full rounded-none opacity-40" />
      </div>
      <Container className="relative mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-site-accent">
          {cfgString(config, "eyebrow", "Welcome")}
        </p>
        <h1 className="mt-4 font-[var(--font-secondary)] text-4xl font-bold leading-tight text-site-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-site-muted">{description}</p>
        <Link
          href={cta.href}
          className={buttonVariants({ variant: "site", size: "lg", className: "mt-8" })}
        >
          {cta.label}
        </Link>
        <div className="mx-auto mt-14 max-w-4xl">
          <VisualBlock
            variant="community"
            className="aspect-[21/9] w-full"
            label="This Sunday"
            imageUrl={cfgMedia(config, "imageUrl")}
            videoUrl={cfgMedia(config, "videoUrl")}
          />
        </div>
      </Container>
    </section>
  );
}

export function HeroFullscreen({ site, config }: SectionProps) {
  const title = cfgString(config, "title", `Welcome to ${site.site.name}`);
  const description = cfgString(
    config,
    "description",
    site.brand.tagline || "A place to belong."
  );
  const cta = ctaHref(config);

  return (
    <section className="relative flex min-h-[85vh] items-end overflow-hidden text-white">
      <VisualBlock
        variant="worship"
        className="absolute inset-0 rounded-none"
        imageUrl={cfgMedia(config, "imageUrl")}
        videoUrl={cfgMedia(config, "videoUrl")}
      />
      <Container className="relative z-10 pb-20 pt-40">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-site-accent">
          {cfgString(config, "eyebrow", site.site.denomination || "Church")}
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/80">{description}</p>
        <Link
          href={cta.href}
          className={buttonVariants({
            size: "lg",
            className: "mt-8 bg-white text-site-primary hover:bg-white/90",
          })}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  );
}

export function HeroCinematic({ site, config }: SectionProps) {
  const title = cfgString(config, "title", site.brand.tagline || `Welcome to ${site.site.name}`);
  const description = cfgString(
    config,
    "description",
    "A gathered people. A living faith. A table with room for you."
  );
  const cta = ctaHref(config);
  const stats = configStats(config, [
    { label: "Gather", value: "Sundays" },
    { label: "Community", value: "Open" },
  ]);

  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden text-white">
      <VisualBlock
        variant="cinematic"
        className="absolute inset-0 rounded-none"
        imageUrl={cfgMedia(config, "imageUrl")}
        videoUrl={cfgMedia(config, "videoUrl")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <Container className="relative z-10 pb-16 pt-40 md:pb-24">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-site-accent">
          {cfgString(config, "eyebrow", site.site.name)}
        </p>
        <h1 className="mt-5 max-w-4xl font-[var(--font-secondary)] text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">{description}</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href={cta.href}
            className={buttonVariants({
              size: "lg",
              className: "rounded-full bg-white px-6 text-site-primary hover:bg-white/90",
            })}
          >
            {cta.label}
          </Link>
          <Link
            href="/sermons"
            className="rounded-full border border-white/25 px-5 py-2.5 text-sm text-white/90 hover:bg-white/10"
          >
            Watch a message
          </Link>
        </div>
        <div className="mt-14 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <StatPill key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </Container>
    </section>
  );
}
