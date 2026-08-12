import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";
import { VisualBlock } from "./visual-block";

export function WelcomeCentered({ site, config }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="mx-auto max-w-2xl text-center">
        <Eyebrow>{cfgString(config, "eyebrow", "Welcome Home")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-site-foreground sm:text-4xl">
          {cfgString(config, "title", `We're glad you're here`)}
        </h2>
        <p className="mt-4 text-lg text-site-muted">
          {cfgString(
            config,
            "description",
            `${site.site.name} is a community built on faith, connection, and belonging. Whoever you are, wherever you're from, there's a place for you here.`
          )}
        </p>
      </Container>
    </section>
  );
}

export function WelcomeSplit({ site, config }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <VisualBlock variant="community" className="h-72 w-full" label="Belong here" />
        <div>
          <Eyebrow>{cfgString(config, "eyebrow", "Welcome Home")}</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-site-foreground sm:text-4xl">
            {cfgString(config, "title", `We're glad you're here`)}
          </h2>
          <p className="mt-4 text-lg text-site-muted">
            {cfgString(
              config,
              "description",
              `${site.site.name} is a community built on faith, connection, and belonging.`
            )}
          </p>
          {site.brand.tagline ? (
            <p className="mt-6 text-sm font-semibold text-site-primary">{site.brand.tagline}</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
