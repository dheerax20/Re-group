import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, cfgString } from "./_shared";
import { buttonVariants } from "@/components/ui/button";

export function CTAFullWidth({ site, config }: SectionProps) {
  const cta = (config.cta as { label?: string; href?: string } | undefined) ?? {};

  return (
    <section className="bg-site-accent py-16 text-center text-white">
      <Container className="mx-auto max-w-xl">
        <h2 className="text-2xl font-bold sm:text-3xl">
          {cfgString(config, "title", `Join us this Sunday at ${site.site.name}`)}
        </h2>
        <p className="mt-3 text-white/85">
          {cfgString(config, "description", "We'd love to meet you.")}
        </p>
        <Link
          href={cta.href ?? "/contact"}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "mt-6 bg-white text-site-foreground hover:bg-white/90",
          })}
        >
          {cta.label ?? "Plan Your Visit"}
        </Link>
      </Container>
    </section>
  );
}
