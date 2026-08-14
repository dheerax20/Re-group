"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { checkSlugAvailable, publishSite } from "@/lib/site/actions";
import { onboardingHref, wizardHref } from "@/lib/onboarding/steps";
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

  useEffect(() => {
    const handle = setTimeout(() => {
      checkSlugAvailable(slug, siteId).then(setSlugStatus);
    }, 350);
    return () => clearTimeout(handle);
  }, [slug, siteId]);

  function handlePublish() {
    startTransition(async () => {
      const result = await publishSite(siteId, slug);
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
      <div className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft p-6 text-center">
        <h2 className="font-serif text-2xl font-semibold text-foreground">Your site is live!</h2>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block font-medium text-brand underline"
        >
          {url}
        </a>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/dashboard?siteId=${siteId}`}>
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href={`/dashboard/builder?siteId=${siteId}`}>
            <Button variant="outline">Open editor</Button>
          </Link>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">View Site</Button>
          </a>
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
          <p className={`mt-1 text-sm ${slugStatus.available ? "text-emerald-600" : "text-red-600"}`}>
            {slugStatus.available ? "Available" : slugStatus.message}
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Fix these before publishing:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
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
          <Link href={`/builder/${siteId}`}>
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
