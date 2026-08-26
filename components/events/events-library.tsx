"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/layout/empty-state";
import { EventCard, type EventCardData } from "@/components/events/event-card";
import {
  EventFormSheet,
  toDatetimeLocal,
  type EventFormValues,
} from "@/components/events/event-form-sheet";

export type EventRecord = EventCardData & {
  description: string | null;
  address: string | null;
  category: string | null;
  organizer: string | null;
  registrationDeadline: Date | null;
  allowGuests: boolean;
  allowWaitlist: boolean;
};

function toFormValues(event: EventRecord): EventFormValues {
  return {
    id: event.id,
    title: event.title,
    startAt: toDatetimeLocal(event.startAt),
    endAt: toDatetimeLocal(event.endAt),
    location: event.location ?? "",
    address: event.address ?? "",
    description: event.description ?? "",
    imageUrl: event.imageUrl ?? "",
    status: event.status,
    category: event.category ?? "",
    organizer: event.organizer ?? "",
    capacity: event.capacity != null ? String(event.capacity) : "",
    registrationDeadline: toDatetimeLocal(event.registrationDeadline),
    rsvpEnabled: event.rsvpEnabled,
    allowGuests: event.allowGuests,
    allowWaitlist: event.allowWaitlist,
  };
}

/**
 * The events library.
 *
 * Which event is being edited lives in the URL (`?edit=<id>`, `?new=1`), not in
 * component state. That is what lets the header's "Create event" button be a
 * plain link, lets a church send someone a link straight to an event's editor,
 * and makes the browser's back button close the sheet — all of which a
 * `useState(false)` would have quietly given up.
 */
export function EventsLibrary({
  siteId,
  events,
  siteUrl,
  filtered,
}: {
  siteId: string;
  events: EventRecord[];
  /** Base URL of the published site, for "View event". Absent while unpublished. */
  siteUrl?: string;
  /** Whether a search or filter is narrowing the list — changes the empty state. */
  filtered: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventRecord | null>(null);

  const createEvent = trpc.content.createEvent.useMutation();
  const deleteEvent = trpc.content.deleteEvent.useMutation();

  const editId = searchParams.get("edit");
  const creating = searchParams.get("new") === "1";
  const editing = editId ? events.find((event) => event.id === editId) : undefined;
  const sheetOpen = creating || Boolean(editing);

  function closeSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("new");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function hrefWith(update: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("new");
    for (const [key, value] of Object.entries(update)) params.set(key, value);
    return `${pathname}?${params.toString()}`;
  }

  function onDuplicate(event: EventRecord) {
    setBusyId(event.id);
    startTransition(async () => {
      try {
        await createEvent.mutateAsync({
          siteId,
          data: {
            // A copy is always a DRAFT: duplicating a live event and having the
            // duplicate immediately appear on the public calendar is never what
            // anyone means by "duplicate".
            title: `${event.title} (copy)`,
            startAt: toDatetimeLocal(event.startAt),
            endAt: toDatetimeLocal(event.endAt),
            location: event.location ?? "",
            address: event.address ?? "",
            description: event.description ?? "",
            imageUrl: event.imageUrl ?? "",
            status: "DRAFT",
            category: event.category ?? "",
            organizer: event.organizer ?? "",
            capacity: event.capacity ?? undefined,
            registrationDeadline: toDatetimeLocal(event.registrationDeadline),
            rsvpEnabled: event.rsvpEnabled,
            allowGuests: event.allowGuests,
            allowWaitlist: event.allowWaitlist,
          },
        });
        toast({ title: "Event duplicated", description: "The copy is saved as a draft." });
        router.refresh();
      } catch (error) {
        toast({
          title: "Could not duplicate",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error",
        });
      } finally {
        setBusyId(null);
      }
    });
  }

  function onDelete() {
    const event = confirmDelete;
    if (!event) return;
    setBusyId(event.id);
    startTransition(async () => {
      try {
        await deleteEvent.mutateAsync({ siteId, eventId: event.id });
        toast({ title: "Event deleted", description: `“${event.title}” was removed.` });
        setConfirmDelete(null);
        if (editId === event.id) closeSheet();
        router.refresh();
      } catch (error) {
        toast({
          title: "Could not delete",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error",
        });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <>
      {events.length === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <Button asChild variant="outline">
                <a href={pathname}>Clear filters</a>
              </Button>
            ) : (
              <Button asChild>
                <a href={hrefWith({ new: "1" })}>Create event</a>
              </Button>
            )
          }
          description={
            filtered
              ? "No events match the filters you've set. Try widening the search."
              : "Add your Sunday service, a midweek gathering, or the next community night."
          }
          icon={CalendarPlus}
          title={filtered ? "No matching events" : "No events yet"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {events.map((event) => (
            <EventCard
              busy={busyId === event.id && pending}
              editHref={hrefWith({ edit: event.id })}
              event={event}
              key={event.id}
              onDelete={() => setConfirmDelete(event)}
              onDuplicate={() => onDuplicate(event)}
              publicHref={siteUrl ? `${siteUrl}/events/${event.slug}` : undefined}
            />
          ))}
        </div>
      )}

      <EventFormSheet
        initial={editing ? toFormValues(editing) : undefined}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
        open={sheetOpen}
        siteId={siteId}
      />

      <Dialog
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
        open={confirmDelete !== null}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.title}” will be removed from your website. Any
              registrations and check-in records for it go too. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setConfirmDelete(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={onDelete} variant="destructive">
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
