"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FormActions,
} from "@/components/onboarding/form-primitives";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  startAt: string | Date;
  location: string | null;
  description: string | null;
};

export function EventsManager({
  siteId,
  events,
}: {
  siteId: string;
  events: EventRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const createEvent = trpc.content.createEvent.useMutation();
  const deleteEvent = trpc.content.deleteEvent.useMutation();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setStartAt("");
    setLocation("");
    setDescription("");
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createEvent.mutateAsync({
          siteId,
          data: { title, startAt, location, description },
        });
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create event");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteEvent.mutateAsync({ siteId, eventId: id });
      router.refresh();
    });
  }

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6", pending && "opacity-70")}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-muted">
          Create events here — they show on your public website automatically.
        </p>
      </div>

      <form onSubmit={onCreate}>
        <FieldGroup title="New event" description="Saved to your church site immediately.">
          <Field>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sunday Worship"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="startAt">Starts</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main sanctuary"
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions>
            <span />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Add event"}
            </Button>
          </FormActions>
        </FieldGroup>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Upcoming & saved</h2>
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No events yet. Add one above to populate your site.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {new Date(event.startAt).toLocaleString()}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(event.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
