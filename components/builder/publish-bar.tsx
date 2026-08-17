"use client";

import { useTransition } from "react";
import { publishSite, unpublishSite } from "@/lib/site/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PublishError } from "@/lib/site/publish-validation";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

function liveUrl(slug: string) {
  if (process.env.NODE_ENV === "development") {
    return `http://${slug}.localhost:3000`;
  }
  return `https://${slug}.${ROOT_DOMAIN}`;
}

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

  function handlePublish() {
    startTransition(async () => {
      const result = await publishSite(siteId, slug);
      if (!result.success) {
        const errors = (result.errors ?? []) as PublishError[];
        alert(`Can't publish yet:\n${errors.map((e) => `• ${e.message}`).join("\n")}`);
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      await unpublishSite(siteId);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <Badge variant={status === "PUBLISHED" ? "success" : "secondary"}>{status}</Badge>
        {status === "PUBLISHED" && (
          <a
            href={liveUrl(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline"
          >
            {liveUrl(slug)}
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
    </div>
  );
}
