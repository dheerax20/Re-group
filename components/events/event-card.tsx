"use client";

import Link from "next/link";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  QrCode,
  SquarePen,
  Trash2,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/layout/status-badge";
import { cn } from "@/lib/utils";

export type EventCardData = {
  id: string;
  title: string;
  slug: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  imageUrl: string | null;
  status: string;
  capacity: number | null;
  rsvpEnabled: boolean;
};

function formatWhen(start: Date): string {
  return start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The cover, when a church has not uploaded one.
 *
 * A grey box with a broken-image icon makes a library of new events look
 * broken; this is a quiet ruled field with the date set large, so an event
 * without a photo still reads as a designed card rather than a gap.
 */
function CoverFallback({ start }: { start: Date }) {
  return (
    <div className="flex size-full flex-col items-center justify-center bg-surface-muted">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {start.toLocaleDateString("en-US", { month: "long" })}
      </span>
      <span className="tabular mt-0.5 text-3xl font-semibold text-foreground/70">
        {start.getDate()}
      </span>
    </div>
  );
}

/**
 * One event in the library.
 *
 * The whole card is the click target (it opens the editor), with the menu
 * layered above it — hence the stretched overlay link rather than wrapping the
 * card in an `<a>`, which would nest the menu button inside a link and break
 * both the markup and the click.
 *
 * There is exactly ONE menu, not five buttons. The old row carried Check in,
 * Registrations, Edit and Delete side by side on every event, which made a
 * calendar of ten look like a control panel.
 */
export function EventCard({
  event,
  editHref,
  publicHref,
  onDuplicate,
  onDelete,
  busy,
}: {
  event: EventCardData;
  editHref: string;
  publicHref?: string;
  onDuplicate: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)] transition-all",
        "hover:border-border-strong hover:shadow-[var(--shadow-lift)]",
        "focus-within:border-border-strong",
        busy && "pointer-events-none opacity-60"
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-muted">
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            src={event.imageUrl}
          />
        ) : (
          <CoverFallback start={event.startAt} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {/*
              The stretched link: it covers the card, so a click anywhere opens
              the editor, while the menu below sits at a higher z-index and
              keeps its own clicks.
            */}
            <Link className="outline-none after:absolute after:inset-0" href={editHref}>
              {event.title}
            </Link>
          </h3>
          <p className="tabular mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">{formatWhen(event.startAt)}</span>
          </p>
          {event.location ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <StatusBadge status={event.status} />
          {event.rsvpEnabled ? (
            <span className="flex items-center gap-1 text-[13px] text-muted">
              <Users className="size-3.5" />
              {event.capacity ? (
                <span className="tabular">{event.capacity} capacity</span>
              ) : (
                "RSVP on"
              )}
            </span>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${event.title}`}
              className="relative z-10 ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground data-[state=open]:bg-surface-muted data-[state=open]:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem asChild>
                <Link href={editHref}>
                  <SquarePen />
                  Edit
                </Link>
              </DropdownMenuItem>
              {publicHref ? (
                <DropdownMenuItem asChild>
                  <a href={publicHref} rel="noopener noreferrer" target="_blank">
                    <ExternalLink />
                    View event
                  </a>
                </DropdownMenuItem>
              ) : null}

              {event.rsvpEnabled ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/events/${event.id}/registrations`}>
                      <Users />
                      Manage registrations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/events/${event.id}/checkin`}>
                      <QrCode />
                      Check-in
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
