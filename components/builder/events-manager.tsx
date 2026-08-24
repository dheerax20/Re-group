"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import {
  Field,
  FieldGroup,
  FormActions,
} from "@/components/onboarding/form-primitives";
import { cn } from "@/lib/utils";

type EventStatus = "DRAFT" | "PUBLISHED" | "REGISTRATION_CLOSED" | "COMPLETED" | "CANCELLED";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  startAt: string | Date;
  endAt: string | Date | null;
  location: string | null;
  description: string | null;
  imageUrl: string | null;
  status: EventStatus;
  category: string | null;
  organizer: string | null;
  address: string | null;
  capacity: number | null;
  registrationDeadline: string | Date | null;
  rsvpEnabled: boolean;
  allowGuests: boolean;
  allowWaitlist: boolean;
};

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  REGISTRATION_CLOSED: "Registration closed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

async function uploadEventImage(siteId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("siteId", siteId);
  formData.append("type", "IMAGE");
  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

function toDatetimeLocal(value: string | Date | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  title: "",
  startAt: "",
  endAt: "",
  location: "",
  address: "",
  description: "",
  imageUrl: "",
  status: "DRAFT" as EventStatus,
  category: "",
  organizer: "",
  capacity: "",
  registrationDeadline: "",
  rsvpEnabled: false,
  allowGuests: false,
  allowWaitlist: false,
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
  const updateEvent = trpc.content.updateEvent.useMutation();
  const deleteEvent = trpc.content.deleteEvent.useMutation();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadEventImage(siteId, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      setError("Could not upload image");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function edit(event: EventRow) {
    setEditingId(event.id);
    setForm({
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
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const data = {
      title: form.title,
      startAt: form.startAt,
      endAt: form.endAt,
      location: form.location,
      address: form.address,
      description: form.description,
      imageUrl: form.imageUrl,
      status: form.status,
      category: form.category,
      organizer: form.organizer,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      registrationDeadline: form.registrationDeadline,
      rsvpEnabled: form.rsvpEnabled,
      allowGuests: form.allowGuests,
      allowWaitlist: form.allowWaitlist,
    };

    startTransition(async () => {
      try {
        if (editingId) {
          await updateEvent.mutateAsync({ siteId, eventId: editingId, data });
        } else {
          await createEvent.mutateAsync({ siteId, data });
        }
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save event");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteEvent.mutateAsync({ siteId, eventId: id });
      if (editingId === id) reset();
      router.refresh();
    });
  }

  return (
    <div className={cn("mx-auto max-w-3xl", pending && "opacity-70")}>
      <PageHeader
        title="Events"
        description="Create events here — published ones show on your public website automatically."
      />
      <div className="space-y-6">

      <form onSubmit={onSubmit}>
        <FieldGroup
          title={editingId ? "Edit event" : "New event"}
          description="Saved to your church site immediately."
        >
          <Field>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Sunday Worship"
              required
            />
          </Field>

          <Field>
            <Label>Cover image</Label>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imageUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : null}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                {uploadingImage ? "Uploading..." : form.imageUrl ? "Change image" : "Upload image"}
              </Button>
              {form.imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="startAt">Starts</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                required
              />
            </Field>
            <Field>
              <Label htmlFor="endAt">Ends</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Main sanctuary"
              />
            </Field>
            <Field>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Youth"
              />
            </Field>
            <Field>
              <Label htmlFor="organizer">Organizer</Label>
              <Input
                id="organizer"
                value={form.organizer}
                onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))}
              />
            </Field>
            <Field>
              <Label htmlFor="status">Status</Label>
              <NativeSelect
                id="status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
              >
                {(Object.keys(STATUS_LABEL) as EventStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </Field>

          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Enable RSVP</p>
                <p className="text-[13px] text-muted">
                  Visitors register directly on the event page and get a QR ticket by email.
                </p>
              </div>
              <Switch
                checked={form.rsvpEnabled}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, rsvpEnabled: checked }))}
                aria-label="Enable RSVP"
              />
            </div>

            {form.rsvpEnabled ? (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      value={form.capacity}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                      placeholder="Unlimited"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="registrationDeadline">Registration deadline</Label>
                    <Input
                      id="registrationDeadline"
                      type="datetime-local"
                      value={form.registrationDeadline}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, registrationDeadline: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowGuests" className="text-sm font-normal">
                    Let attendees bring guests
                  </Label>
                  <Switch
                    id="allowGuests"
                    checked={form.allowGuests}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, allowGuests: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowWaitlist" className="text-sm font-normal">
                    Waitlist once capacity is reached
                  </Label>
                  <Switch
                    id="allowWaitlist"
                    checked={form.allowWaitlist}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, allowWaitlist: checked }))}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions>
            {editingId ? (
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                Cancel
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editingId ? "Save changes" : "Add event"}
            </Button>
          </FormActions>
        </FieldGroup>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Upcoming & saved</h2>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No events yet"
            description="Add one above to populate your site."
            compact
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{event.title}</p>
                    <Badge variant={event.status === "PUBLISHED" ? "success" : "secondary"}>
                      {STATUS_LABEL[event.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {new Date(event.startAt).toLocaleString()}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {event.rsvpEnabled ? (
                    <Link href={`/events/${event.id}/registrations`}>
                      <Button type="button" variant="outline" size="sm">
                        Registrations
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => edit(event)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onDelete(event.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
