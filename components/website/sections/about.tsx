import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";
import { VisualBlock } from "./visual-block";

export function AboutImageRight({ site, config }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div>
          <Eyebrow>{cfgString(config, "eyebrow", "About Us")}</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-site-foreground sm:text-4xl">
            {cfgString(config, "title", `Who We Are`)}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-site-muted">
            {cfgString(
              config,
              "description",
              `${site.site.name} exists to help people know God and grow in community. We gather to worship, learn, and serve together.`
            )}
          </p>
          {site.site.denomination ? (
            <p className="mt-6 text-sm font-medium text-site-primary">
              {site.site.denomination}
              {site.site.congregationSize
                ? ` · ${site.site.congregationSize}+ people`
                : ""}
            </p>
          ) : null}
        </div>
        <VisualBlock variant="nature" className="aspect-[4/3] w-full" label="Our story" />
      </Container>
    </section>
  );
}

export function AboutImageLeft({ site, config }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <VisualBlock variant="editorial" className="aspect-[4/3] w-full" label="Heritage" />
        </div>
        <div className="order-1 md:order-2">
          <Eyebrow>{cfgString(config, "eyebrow", "About Us")}</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-site-foreground sm:text-4xl">
            {cfgString(config, "title", `Who We Are`)}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-site-muted">
            {cfgString(
              config,
              "description",
              `${site.site.name} exists to help people know God and grow in community. We gather to worship, learn, and serve together.`
            )}
          </p>
        </div>
      </Container>
    </section>
  );
}
