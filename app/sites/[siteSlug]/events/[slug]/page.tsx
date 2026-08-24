import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, Clock, MapPin, User, Tag } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedEvents, findEventBySlug } from "@/lib/site/get-site-events";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { headingScaleClass } from "@/components/website/blocks/tokens";
import { RsvpForm } from "@/components/website/events/rsvp-form";
import { cn } from "@/lib/utils";

export const revalidate = 300;

/** Not a component — plain helper, so the impure `Date.now()` read is fine. */
function hasDeadlinePassed(registrationDeadline: string | null): boolean {
  return registrationDeadline != null && new Date(registrationDeadline).getTime() < Date.now();
}

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-site-foreground">
      <Icon className="mt-0.5 size-5 shrink-0 text-site-accent" />
      <span className="text-base leading-snug">{children}</span>
    </div>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const { siteSlug, slug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.events) notFound();

  const allEvents = await getCachedEvents(data.site.site.id, siteSlug);
  const event = findEventBySlug(allEvents, slug);
  if (!event) notFound();

  const deadlinePassed = hasDeadlinePassed(event.registrationDeadline);
  const rsvpOpen = event.rsvpEnabled && event.status === "PUBLISHED" && !deadlinePassed;

  // Live count, not the cached list — capacity has to reflect the moment a
  // visitor is deciding whether to register, not up to 5 minutes ago.
  const spotsTaken =
    rsvpOpen && event.capacity != null
      ? (
          await prisma.registration.findMany({
            where: { eventId: event.id, status: "CONFIRMED" },
            select: { guestCount: true },
          })
        ).reduce((sum, r) => sum + 1 + r.guestCount, 0)
      : null;
  const isFull = spotsTaken != null && event.capacity != null && spotsTaken >= event.capacity;

  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const timeRange = end
    ? `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <article>
      {event.imageUrl ? (
        <div className="relative aspect-21/9 w-full overflow-hidden bg-site-primary/10">
          <Image src={event.imageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-site-muted hover:text-site-accent"
        >
          <ArrowLeft className="size-4" />
          All events
        </Link>

        <div className="mt-8">
          {event.category ? (
            <Badge variant="accent" className="mb-3">
              {event.category}
            </Badge>
          ) : null}
          <h1 className={cn(headingScaleClass.h1, "text-site-foreground")}>{event.title}</h1>
        </div>

        <div className="mt-8 grid gap-4 rounded-2xl border border-site-muted/15 p-6 sm:grid-cols-2">
          <MetaRow icon={Calendar}>
            {start.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </MetaRow>
          <MetaRow icon={Clock}>{timeRange}</MetaRow>
          {event.location ? <MetaRow icon={MapPin}>{event.location}</MetaRow> : null}
          {event.organizer ? <MetaRow icon={User}>Hosted by {event.organizer}</MetaRow> : null}
          {event.address ? <MetaRow icon={Tag}>{event.address}</MetaRow> : null}
        </div>

        {event.description ? (
          <p className="mt-10 text-lg leading-relaxed text-site-muted">{event.description}</p>
        ) : null}

        <div className="mt-10">
          {rsvpOpen ? (
            <>
              {event.capacity != null ? (
                <p className="mb-4 text-sm text-site-muted">
                  {isFull ? "This event is full." : `${spotsTaken} of ${event.capacity} spots taken`}
                </p>
              ) : null}
              <RsvpForm
                event={{
                  id: event.id,
                  title: event.title,
                  startAt: event.startAt,
                  location: event.location,
                  allowGuests: event.allowGuests,
                }}
              />
            </>
          ) : event.registrationUrl ? (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "site", size: "lg" })}
            >
              Register
            </a>
          ) : event.status === "REGISTRATION_CLOSED" || deadlinePassed ? (
            <p className="text-sm text-site-muted">Registration is closed for this event.</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
