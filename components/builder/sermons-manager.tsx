"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSermon, deleteSermon } from "@/lib/site/content-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FormActions,
} from "@/components/onboarding/form-primitives";

type SermonRow = {
  id: string;
  title: string;
  date: string | Date;
  speaker: string | null;
  series: string | null;
};

export function SermonsManager({
  siteId,
  sermons,
}: {
  siteId: string;
  sermons: SermonRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [series, setSeries] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setDate("");
    setSpeaker("");
    setSeries("");
    setVideoUrl("");
    setDescription("");
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createSermon(siteId, {
          title,
          date,
          speaker,
          series,
          videoUrl,
          description,
        });
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create sermon");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteSermon(siteId, id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sermons</h1>
        <p className="mt-1 text-sm text-muted">
          Add messages here — they appear in your website sermons section and pages.
        </p>
      </div>

      <form onSubmit={onCreate}>
        <FieldGroup title="New sermon" description="Synced to the live church website.">
          <Field>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hope for Today"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label htmlFor="speaker">Speaker</Label>
              <Input
                id="speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="Pastor Name"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="series">Series</Label>
              <Input
                id="series"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="Foundations"
              />
            </Field>
            <Field>
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <FormActions>
            <span />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Add sermon"}
            </Button>
          </FormActions>
        </FieldGroup>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Library</h2>
        {sermons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No sermons yet. Add one to populate your site.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {sermons.map((sermon) => (
              <li
                key={sermon.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{sermon.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {new Date(sermon.date).toLocaleDateString()}
                    {sermon.speaker ? ` · ${sermon.speaker}` : ""}
                    {sermon.series ? ` · ${sermon.series}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(sermon.id)}
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
