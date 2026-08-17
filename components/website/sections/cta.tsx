import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, cfgString, cfgCta, cfgMedia } from "./_shared";
import { buttonVariants } from "@/components/ui/button";
import { VisualBlock } from "./visual-block";

export function CTAFullWidth({ site, config }: SectionProps) {
  // Reads both `cta` and `primaryCta`: templates write the first, the AI crew
  // writes the second, and a section can carry either.
  const cta = cfgCta(
    config,
    config.cta ? "cta" : "primaryCta",
    { label: "Plan Your Visit", href: "/contact" }
  );
  const imageUrl = cfgMedia(config, "imageUrl");

  return (
    <section className="relative overflow-hidden py-20 text-center text-white">
      {imageUrl ? (
        <VisualBlock
          variant="cinematic"
          className="absolute inset-0 rounded-none"
          imageUrl={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-site-primary" />
      )}
      <div className="absolute inset-0 bg-site-primary/55" />
      <Container className="relative mx-auto max-w-xl">
        <h2 className="text-2xl font-bold sm:text-3xl">
          {cfgString(config, "title", `Join us this Sunday at ${site.site.name}`)}
        </h2>
        <p className="mt-3 text-white/85">
          {cfgString(config, "description", "We'd love to meet you.")}
        </p>
        <Link
          href={cta.href}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "mt-6 border-white/40 bg-white text-site-foreground hover:bg-white/90",
          })}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  );
}
