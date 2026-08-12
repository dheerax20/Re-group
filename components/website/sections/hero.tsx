import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, cfgString } from "./_shared";
import { buttonVariants } from "@/components/ui/button";
import { StatPill, VisualBlock } from "./visual-block";

function ctaHref(config: Record<string, unknown>): { label: string; href: string } {
  const cta = config.primaryCta as { label?: string; href?: string } | undefined;
  return {
    label: cta?.label ?? "Plan Your Visit",
    href: cta?.href ?? "/contact",
  };
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

  return (
    <section className="relative overflow-hidden bg-site-primary text-white">
      <div className="absolute inset-0 opacity-30">
        <VisualBlock variant="worship" className="h-full rounded-none" />
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
          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <StatPill label="Community" value={size} />
            <StatPill label="Gather" value="Sundays" />
          </div>
        </div>
        <VisualBlock
          variant="sanctuary"
          className="min-h-[280px] md:min-h-[420px]"
          label={site.site.name}
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
          <VisualBlock variant="community" className="aspect-[21/9] w-full" label="This Sunday" />
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
      <VisualBlock variant="worship" className="absolute inset-0 rounded-none" />
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
