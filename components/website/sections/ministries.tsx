import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";

const sampleMinistries = [
  { name: "Kids Ministry", description: "Fun, safe, gospel-centered programming for kids of all ages." },
  { name: "Youth Group", description: "A place for students to connect, grow, and belong." },
  { name: "Worship Team", description: "Leading our congregation in worship through music." },
];

export function MinistryGrid({ config }: SectionProps) {
  const ministries =
    (config.items as Array<{ name: string; description: string }> | undefined) ??
    sampleMinistries;

  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Get Involved")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-site-foreground sm:text-4xl">
          {cfgString(config, "title", "Ministries")}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ministries.map((ministry, index) => (
            <div
              key={ministry.name}
              className="overflow-hidden rounded-2xl border border-site-muted/15 bg-site-background shadow-sm"
            >
              <div
                className="h-28"
                style={{
                  background:
                    index % 3 === 0
                      ? `linear-gradient(135deg, var(--color-primary), var(--color-accent))`
                      : index % 3 === 1
                        ? `linear-gradient(135deg, var(--color-secondary), var(--color-primary))`
                        : `linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 70%, black), var(--color-accent))`,
                }}
              />
              <div className="p-6">
                <h3 className="font-semibold text-site-foreground">{ministry.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-site-muted">
                  {ministry.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
