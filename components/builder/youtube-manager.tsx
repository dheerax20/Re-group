"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateYoutubeChannel } from "@/lib/site/content-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldGroup,
  FieldHint,
  FormActions,
} from "@/components/onboarding/form-primitives";

export function YoutubeManager({
  siteId,
  channelUrl,
}: {
  siteId: string;
  channelUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(channelUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateYoutubeChannel(siteId, { channelUrl: url });
        setMessage(url ? "YouTube section updated on your website." : "YouTube section disabled.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">YouTube</h1>
        <p className="mt-1 text-sm text-muted">
          Connect your channel — it powers the media section on your website.
        </p>
      </div>

      <form onSubmit={onSave}>
        <FieldGroup title="Channel" description="Paste your channel or playlist URL.">
          <Field>
            <Label htmlFor="channelUrl">YouTube URL</Label>
            <Input
              id="channelUrl"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/@yourchurch"
            />
            <FieldHint>Leave empty to hide the YouTube section on the public site.</FieldHint>
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <FormActions>
            <span />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FormActions>
        </FieldGroup>
      </form>
    </div>
  );
}
