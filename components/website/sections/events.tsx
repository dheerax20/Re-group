import Link from "next/link";
import Image from "next/image";
import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, EmptyState, cfgString } from "./_shared";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventGrid({ config, content }: SectionProps) {
  const events = content.events.slice(0, 6);
  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Upcoming Events")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "What's Happening")}
        </h2>
        {events.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No upcoming events." />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group rounded-lg border border-site-muted/15 overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="aspect-video bg-site-secondary/10">
                  {event.imageUrl ? (
                    <Image
                      src={event.imageUrl}
                      alt={event.title}
                      width={400}
                      height={225}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 75%, white), var(--color-accent))`,
                      }}
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium text-site-accent">
                    {formatDate(event.startAt)}
                  </p>
                  <h3 className="mt-1 font-semibold text-site-foreground group-hover:text-site-accent">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="mt-1 text-sm text-site-muted">{event.location}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

export function EventList({ config, content }: SectionProps) {
  return (
    <section className="bg-site-background py-20">
      <Container className="max-w-3xl">
        <Eyebrow>{cfgString(config, "eyebrow", "Upcoming Events")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "What's Happening")}
        </h2>
        {content.events.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No upcoming events." />
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-site-muted/15">
            {content.events.slice(0, 8).map((event) => (
              <li key={event.id} className="py-4">
                <Link href={`/events/${event.slug}`} className="flex items-center justify-between hover:text-site-accent">
                  <span>
                    <span className="font-medium">{event.title}</span>
                    {event.location && (
                      <span className="ml-2 text-sm text-site-muted">{event.location}</span>
                    )}
                  </span>
                  <span className="text-sm text-site-muted">{formatDate(event.startAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

export function EventCalendar({ config, content }: SectionProps) {
  const groups = content.events.reduce<Record<string, typeof content.events>>(
    (acc, event) => {
      const key = new Date(event.startAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      acc[key] = acc[key] ? [...acc[key], event] : [event];
      return acc;
    },
    {}
  );

  return (
    <section className="bg-site-background py-20">
      <Container className="max-w-3xl">
        <Eyebrow>{cfgString(config, "eyebrow", "Upcoming Events")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Calendar")}
        </h2>
        {content.events.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No upcoming events." />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {Object.entries(groups).map(([month, events]) => (
              <div key={month}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-site-muted">
                  {month}
                </h3>
                <ul className="mt-3 divide-y divide-site-muted/15">
                  {events.map((event) => (
                    <li key={event.id} className="py-3">
                      <Link href={`/events/${event.slug}`} className="flex items-center justify-between hover:text-site-accent">
                        <span className="font-medium">{event.title}</span>
                        <span className="text-sm text-site-muted">{formatDate(event.startAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
