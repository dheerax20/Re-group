"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { youtubeThumbnail } from "@/lib/media/youtube";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type SermonFormValues = {
  id?: string;
  title: string;
  speaker: string;
  date: string;
  series: string;
  videoUrl: string;
  audioUrl: string;
  thumbnailUrl: string;
  description: string;
};

export const EMPTY_SERMON: SermonFormValues = {
  title: "",
  speaker: "",
  date: "",
  series: "",
  videoUrl: "",
  audioUrl: "",
  thumbnailUrl: "",
  description: "",
};

export function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
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

/**
 * Add and edit a sermon.
 *
 * Kept deliberately light: a message is a title, who preached it, when, and a
 * link. Everything else — series, artwork, description — is optional and
 * grouped below, so adding last Sunday's recording is four fields and a paste.
 */
export function SermonFormSheet({
  siteId,
  open,
  initial,
  onOpenChange,
}: {
  siteId: string;
  open: boolean;
  initial?: SermonFormValues;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const createSermon = trpc.content.createSermon.useMutation();
  const updateSermon = trpc.content.updateSermon.useMutation();

  const editingId = initial?.id;
  const [form, setForm] = useState<SermonFormValues>(initial ?? EMPTY_SERMON);
  const [seeded, setSeeded] = useState(initial?.id ?? "new");
  const [error, setError] = useState<string | null>(null);

  const key = initial?.id ?? "new";
  if (key !== seeded) {
    setSeeded(key);
    setForm(initial ?? EMPTY_SERMON);
    setError(null);
  }

  function set<K extends keyof SermonFormValues>(field: K, value: SermonFormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // The poster the library will actually show, previewed live as the video URL
  // is pasted — so a church can see straight away that their link worked.
  const preview = form.thumbnailUrl || youtubeThumbnail(form.videoUrl);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const data = {
      title: form.title,
      speaker: form.speaker,
      date: form.date,
      series: form.series,
      videoUrl: form.videoUrl,
      audioUrl: form.audioUrl,
      thumbnailUrl: form.thumbnailUrl,
      description: form.description,
    };

    startTransition(async () => {
      try {
        if (editingId) {
          await updateSermon.mutateAsync({ siteId, sermonId: editingId, data });
        } else {
          await createSermon.mutateAsync({ siteId, data });
        }
        toast({
          title: editingId ? "Sermon updated" : "Sermon added",
          description: "Your sermons page has been updated.",
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this sermon.");
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
          <SheetTitle>{editingId ? "Edit sermon" : "Add sermon"}</SheetTitle>
          <SheetDescription>
            Sermons appear in your website&rsquo;s message library.
          </SheetDescription>
        </SheetHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="chrome-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
            <FormSection title="Message">
              <Field htmlFor="sermon-title" label="Title">
                <Input
                  id="sermon-title"
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Hope for Today"
                  required
                  value={form.title}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="sermon-speaker" label="Speaker">
                  <Input
                    id="sermon-speaker"
                    onChange={(e) => set("speaker", e.target.value)}
                    placeholder="Pastor John"
                    value={form.speaker}
                  />
                </Field>
                <Field htmlFor="sermon-date" label="Date">
                  <Input
                    id="sermon-date"
                    onChange={(e) => set("date", e.target.value)}
                    required
                    type="date"
                    value={form.date}
                  />
                </Field>
              </div>

              <Field
                hint="Group related messages together, e.g. a teaching series."
                htmlFor="sermon-series"
                label="Series"
              >
                <Input
                  id="sermon-series"
                  onChange={(e) => set("series", e.target.value)}
                  placeholder="Foundations"
                  value={form.series}
                />
              </Field>
            </FormSection>

            <FormSection
              description="Paste a YouTube link and we'll use its thumbnail automatically."
              title="Media"
            >
              <Field htmlFor="sermon-video" label="Video URL">
                <Input
                  id="sermon-video"
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  type="url"
                  value={form.videoUrl}
                />
              </Field>

              <Field htmlFor="sermon-audio" label="Audio URL">
                <Input
                  id="sermon-audio"
                  onChange={(e) => set("audioUrl", e.target.value)}
                  placeholder="https://…"
                  type="url"
                  value={form.audioUrl}
                />
              </Field>

              <Field
                hint="Optional. Leave blank to use the video's own thumbnail."
                htmlFor="sermon-thumb"
                label="Thumbnail URL"
              >
                <Input
                  id="sermon-thumb"
                  onChange={(e) => set("thumbnailUrl", e.target.value)}
                  placeholder="https://…"
                  type="url"
                  value={form.thumbnailUrl}
                />
              </Field>

              {preview ? (
                <div className="overflow-hidden rounded-panel border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Thumbnail preview"
                    className="aspect-video w-full object-cover"
                    src={preview}
                  />
                </div>
              ) : null}
            </FormSection>

            <FormSection title="Details">
              <Field htmlFor="sermon-description" label="Description">
                <Textarea
                  id="sermon-description"
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="A short summary of the message."
                  rows={4}
                  value={form.description}
                />
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
              {editingId ? "Save changes" : "Add sermon"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
