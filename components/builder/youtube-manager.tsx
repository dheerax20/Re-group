"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import {
  Field,
  FieldGroup,
  FieldHint,
  FormActions,
} from "@/components/onboarding/form-primitives";
import { cn } from "@/lib/utils";

export function YoutubeManager({
  siteId,
  channelUrl,
}: {
  siteId: string;
  channelUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const updateYoutube = trpc.content.updateYoutube.useMutation();
  const [url, setUrl] = useState(channelUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateYoutube.mutateAsync({ siteId, data: { channelUrl: url } });
        setMessage(url ? "YouTube section updated on your website." : "YouTube section disabled.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <div className={cn("mx-auto max-w-3xl", pending && "opacity-70")}>
      <PageHeader
        title="YouTube"
        description="Connect your channel — it powers the media section on your website."
      />
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-success">{message}</p> : null}
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
