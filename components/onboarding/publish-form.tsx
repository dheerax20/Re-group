"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { wizardHref } from "@/lib/onboarding/steps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PublishError } from "@/lib/site/publish-validation";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

function liveUrl(slug: string) {
  if (process.env.NODE_ENV === "development") {
    return `http://${slug}.localhost:3000`;
  }
  return `https://${slug}.${ROOT_DOMAIN}`;
}

export function PublishForm({
  siteId,
  suggestedSlug,
  initialErrors,
}: {
  siteId: string;
  suggestedSlug: string;
  initialErrors: PublishError[];
}) {
  const [slug, setSlug] = useState(suggestedSlug);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; message?: string } | null>(null);
  const [errors, setErrors] = useState<PublishError[]>(initialErrors);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const utils = trpc.useUtils();
  const publish = trpc.site.publish.useMutation();

  // Debounced so typing an address does not fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      void utils.site.checkSlug
        .fetch({ siteId, slug })
        .then(setSlugStatus)
        .catch(() => setSlugStatus(null));
    }, 350);
    return () => clearTimeout(handle);
  }, [slug, siteId, utils]);

  function handlePublish() {
    startTransition(async () => {
      const result = await publish.mutateAsync({ siteId, slug });
      if (!result.success) {
        setErrors(result.errors ?? []);
        return;
      }
      setErrors([]);
      setPublishedSlug(result.slug ?? slug);
    });
  }

  if (publishedSlug) {
    const url = liveUrl(publishedSlug);
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-panel border border-accent/30 bg-accent-soft p-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Your site is live
          </h2>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block font-medium text-brand underline"
          >
            {url}
          </a>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard">
              <Button>Go to dashboard</Button>
            </Link>
            <Link href="/dashboard/builder">
              <Button variant="outline">Open editor</Button>
            </Link>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">View site</Button>
            </a>
          </div>
        </div>

        {/* The moment a church most wants their own address is right after
            seeing the platform one, so the offer belongs here. */}
        <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
            <Globe className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Use your own domain</p>
            <p className="mt-0.5 text-xs text-muted">
              Already own something like gracechurch.org? Point it here and we
              will show you exactly which DNS record to add.
            </p>
          </div>
          <Link href="/dashboard/domains">
            <Button variant="outline" size="sm">
              Connect a domain
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <Label htmlFor="slug">Your web address</Label>
        <div className="flex items-center gap-2">
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <span className="whitespace-nowrap text-sm text-muted">.{ROOT_DOMAIN}</span>
        </div>
        {slugStatus && (
          <p className={`mt-1 text-sm ${slugStatus.available ? "text-success" : "text-destructive"}`}>
            {slugStatus.available ? "Available" : slugStatus.message}
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive-soft p-4">
          <p className="text-sm font-medium text-destructive">Fix these before publishing:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
            {errors.map((err) => (
              <li key={err.field}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <a href={wizardHref("templates", siteId)} className="text-sm text-muted hover:text-foreground">
          Back
        </a>
        <div className="flex gap-2">
          <Link href="/dashboard/builder">
            <Button type="button" variant="outline">
              Edit in Builder
            </Button>
          </Link>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPending || !slugStatus?.available}
          >
            {isPending ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
