import Link from "next/link";
import Image from "next/image";
import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, EmptyState, cfgString } from "./_shared";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SermonCards({ config, content }: SectionProps) {
  const sermons = content.sermons.slice(0, 6);
  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Latest Sermons")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Recent Messages")}
        </h2>
        {sermons.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No sermons have been added yet." />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => (
              <Link
                key={sermon.id}
                href={`/sermons/${sermon.slug}`}
                className="group rounded-lg border border-site-muted/15 overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="aspect-video bg-site-primary/10">
                  {sermon.thumbnailUrl ? (
                    <Image
                      src={sermon.thumbnailUrl}
                      alt={sermon.title}
                      width={400}
                      height={225}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-end p-4"
                      style={{
                        background: `linear-gradient(160deg, var(--color-primary), color-mix(in oklab, var(--color-accent) 55%, var(--color-primary)))`,
                      }}
                    >
                      <span className="text-xs font-medium text-white/80">
                        {sermon.series || "Message"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {sermon.series && <Badge variant="secondary">{sermon.series}</Badge>}
                  <h3 className="mt-2 font-semibold text-site-foreground group-hover:text-site-accent">
                    {sermon.title}
                  </h3>
                  <p className="mt-1 text-sm text-site-muted">
                    {sermon.speaker ?? "Guest Speaker"} &middot; {formatDate(sermon.date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

export function SermonFeatured({ config, content }: SectionProps) {
  const [featured, ...rest] = content.sermons;
  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Latest Sermons")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Recent Messages")}
        </h2>
        {!featured ? (
          <div className="mt-8">
            <EmptyState message="No sermons have been added yet." />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <Link
              href={`/sermons/${featured.slug}`}
              className="block aspect-video rounded-lg bg-site-primary/10"
            >
              {featured.thumbnailUrl && (
                <Image
                  src={featured.thumbnailUrl}
                  alt={featured.title}
                  width={600}
                  height={340}
                  className="h-full w-full rounded-lg object-cover"
                />
              )}
            </Link>
            <div>
              <h3 className="text-2xl font-semibold text-site-foreground">
                {featured.title}
              </h3>
              <p className="mt-2 text-site-muted">
                {featured.speaker ?? "Guest Speaker"} &middot; {formatDate(featured.date)}
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {rest.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <Link href={`/sermons/${s.slug}`} className="hover:text-site-accent">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

export function SermonList({ config, content }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="max-w-3xl">
        <Eyebrow>{cfgString(config, "eyebrow", "Latest Sermons")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Recent Messages")}
        </h2>
        {content.sermons.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No sermons have been added yet." />
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-site-muted/15">
            {content.sermons.slice(0, 8).map((sermon) => (
              <li key={sermon.id} className="py-4">
                <Link href={`/sermons/${sermon.slug}`} className="flex items-center justify-between hover:text-site-accent">
                  <span className="font-medium">{sermon.title}</span>
                  <span className="text-sm text-site-muted">{formatDate(sermon.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
