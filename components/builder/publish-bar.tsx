"use client";

import { useTransition } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PublishError } from "@/lib/site/publish-validation";
import { liveSiteUrl } from "@/lib/site/live-url";

export function PublishBar({
  siteId,
  slug,
  status,
}: {
  siteId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}) {
  const [isPending, startTransition] = useTransition();
  const utils = trpc.useUtils();
  const publish = trpc.site.publish.useMutation({
    onSuccess: () => utils.site.invalidate(),
  });
  const unpublish = trpc.site.unpublish.useMutation({
    onSuccess: () => utils.site.invalidate(),
  });

  function handlePublish() {
    startTransition(async () => {
      const result = await publish.mutateAsync({ siteId, slug });
      if (!result.success) {
        const errors = (result.errors ?? []) as PublishError[];
        alert(`Can't publish yet:\n${errors.map((e) => `• ${e.message}`).join("\n")}`);
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      await unpublish.mutateAsync({ siteId });
    });
  }

  return (
    <Card padding="sm" className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge variant={status === "PUBLISHED" ? "success" : "secondary"}>{status}</Badge>
        {status === "PUBLISHED" && (
          <a
            href={liveSiteUrl(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline"
          >
            {liveSiteUrl(slug)}
          </a>
        )}
      </div>
      {status === "PUBLISHED" ? (
        <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={isPending}>
          Unpublish
        </Button>
      ) : (
        <Button size="sm" onClick={handlePublish} disabled={isPending}>
          {isPending ? "Publishing..." : "Publish"}
        </Button>
      )}
    </Card>
  );
}
