"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { EVENT_STATUS_OPTIONS } from "@/components/layout/status-badge";
import { cn } from "@/lib/utils";

export type EventFormValues = {
  id?: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  address: string;
  description: string;
  imageUrl: string;
  status: string;
  category: string;
  organizer: string;
  capacity: string;
  registrationDeadline: string;
  rsvpEnabled: boolean;
  allowGuests: boolean;
  allowWaitlist: boolean;
};

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  startAt: "",
  endAt: "",
  location: "",
  address: "",
  description: "",
  imageUrl: "",
  status: "DRAFT",
  category: "",
  organizer: "",
  capacity: "",
  registrationDeadline: "",
  rsvpEnabled: false,
  allowGuests: false,
  allowWaitlist: false,
};

export function toDatetimeLocal(value: string | Date | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

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

/**
 * A titled block of fields.
 *
 * The old form was thirteen fields in a single column with one heading, so
 * "when is it" and "can people RSVP" carried equal weight and the whole thing
 * had to be read start to finish. Sections let a church fill in the four fields
 * they care about and skip the rest.
 */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <div className="mb-3.5">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Create and edit, in a side sheet.
 *
 * The form used to live permanently above the event list, which meant the
 * first thing a church saw on the Events page was a blank form and the
 * *second* was their events. Here it is summoned, it is wide enough for two
 * columns on a desktop, and the library stays visible behind it.
 */
export function EventFormSheet({
  siteId,
  open,
  initial,
  onOpenChange,
}: {
  siteId: string;
  open: boolean;
  /** Undefined while creating. */
  initial?: EventFormValues;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const createEvent = trpc.content.createEvent.useMutation();
  const updateEvent = trpc.content.updateEvent.useMutation();

  const editingId = initial?.id;
  const [form, setForm] = useState<EventFormValues>(initial ?? EMPTY_EVENT);
  const [seeded, setSeeded] = useState(initial?.id ?? "new");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Re-seed when the sheet is pointed at a different event. Done during render
  // rather than in an effect so the fields never paint with the previous
  // event's values for a frame.
  const key = initial?.id ?? "new";
  if (key !== seeded) {
    setSeeded(key);
    setForm(initial ?? EMPTY_EVENT);
    setError(null);
  }

  function set<K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      set("imageUrl", await uploadEventImage(siteId, file));
    } catch {
      setError("Could not upload that image. Try a smaller JPG or PNG.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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
        toast({
          title: editingId ? "Event updated" : "Event created",
          description:
            form.status === "PUBLISHED"
              ? "It's live on your church website."
              : "Saved as a draft — publish it when you're ready.",
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this event.");
      }
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl"
        side="right"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{editingId ? "Edit event" : "Create event"}</SheetTitle>
          <SheetDescription>
            Published events appear on your church website automatically.
          </SheetDescription>
        </SheetHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="chrome-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
            <FormSection title="Basic information">
              <Field htmlFor="event-title" label="Title">
                <Input
                  id="event-title"
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Sunday Worship"
                  required
                  value={form.title}
                />
              </Field>

              <Field htmlFor="event-description" label="Description">
                <Textarea
                  id="event-description"
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What should visitors know before they come?"
                  rows={3}
                  value={form.description}
                />
              </Field>

              <Field hint="Shown at the top of the event card and page. 16:9 works best." label="Cover image">
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-14 w-24 shrink-0 rounded-lg border border-border object-cover"
                      src={form.imageUrl}
                    />
                  ) : (
                    <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-muted text-muted">
                      <ImagePlus className="size-4" />
                    </div>
                  )}
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={onImageChange}
                    ref={imageInputRef}
                    type="file"
                  />
                  <Button
                    disabled={uploading}
                    onClick={() => imageInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : null}
                    {uploading ? "Uploading…" : form.imageUrl ? "Replace" : "Upload"}
                  </Button>
                  {form.imageUrl ? (
                    <Button
                      onClick={() => set("imageUrl", "")}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      aria-label="Remove cover image"
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </Field>
            </FormSection>

            <FormSection title="Date & location">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="event-start" label="Starts">
                  {/*
                    The trigger is a button, so the `required` this field used
                    to carry cannot apply. `eventInputSchema` rejects an empty
                    `startAt` and the error line below renders the refusal.
                  */}
                  <DateTimePicker
                    id="event-start"
                    onChange={(next) => set("startAt", next)}
                    value={form.startAt}
                  />
                </Field>
                <Field htmlFor="event-end" label="Ends">
                  <DateTimePicker
                    id="event-end"
                    onChange={(next) => set("endAt", next)}
                    value={form.endAt}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="event-location" label="Location">
                  <Input
                    id="event-location"
                    onChange={(e) => set("location", e.target.value)}
                    placeholder="Main sanctuary"
                    value={form.location}
                  />
                </Field>
                <Field htmlFor="event-address" label="Address">
                  <Input
                    id="event-address"
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="123 Main St"
                    value={form.address}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="event-category" label="Category">
                  <Input
                    id="event-category"
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="Youth"
                    value={form.category}
                  />
                </Field>
                <Field htmlFor="event-organizer" label="Organizer">
                  <Input
                    id="event-organizer"
                    onChange={(e) => set("organizer", e.target.value)}
                    placeholder="Pastor Ruth"
                    value={form.organizer}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="Let visitors register on the event page and receive a QR ticket by email."
              title="Registration"
            >
              <div className="flex items-center justify-between gap-4 rounded-panel border border-border bg-surface-muted/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">Enable RSVP</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Turns on registrations, tickets and check-in for this event.
                  </p>
                </div>
                <Switch
                  aria-label="Enable RSVP"
                  checked={form.rsvpEnabled}
                  onCheckedChange={(checked) => set("rsvpEnabled", checked)}
                />
              </div>

              {form.rsvpEnabled ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      hint="Leave blank for unlimited."
                      htmlFor="event-capacity"
                      label="Capacity"
                    >
                      <Input
                        id="event-capacity"
                        min={1}
                        onChange={(e) => set("capacity", e.target.value)}
                        placeholder="Unlimited"
                        type="number"
                        value={form.capacity}
                      />
                    </Field>
                    <Field htmlFor="event-deadline" label="Registration deadline">
                      <DateTimePicker
                        id="event-deadline"
                        onChange={(next) => set("registrationDeadline", next)}
                        value={form.registrationDeadline}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Label className="font-normal" htmlFor="event-guests">
                      Let attendees bring guests
                    </Label>
                    <Switch
                      checked={form.allowGuests}
                      id="event-guests"
                      onCheckedChange={(checked) => set("allowGuests", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="font-normal" htmlFor="event-waitlist">
                      Waitlist once capacity is reached
                    </Label>
                    <Switch
                      checked={form.allowWaitlist}
                      id="event-waitlist"
                      onCheckedChange={(checked) => set("allowWaitlist", checked)}
                    />
                  </div>
                </div>
              ) : null}
            </FormSection>

            <FormSection title="Publishing">
              <Field
                hint="Drafts are only visible to you."
                htmlFor="event-status"
                label="Status"
              >
                <NativeSelect
                  id="event-status"
                  onChange={(e) => set("status", e.target.value)}
                  value={form.status}
                >
                  {EVENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </FormSection>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3.5">
            {error ? (
              <p className="mr-auto text-[13px] text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Loader2 className="animate-spin" /> : null}
              {editingId ? "Save changes" : "Save event"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
