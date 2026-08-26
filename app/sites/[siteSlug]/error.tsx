"use client";

import { ErrorState } from "@/components/layout/error-state";

/**
 * A visitor to a church's public website — not a Regroup customer. The copy
 * says nothing about the platform, offers no dashboard link, and never names
 * the church's own site as "broken"; it just invites them to retry.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      logLabel="[public-site]"
      title="This page didn't load"
      description="Sorry about that. Please try again in a moment."
      error={error}
      retry={retry}
      className="min-h-[60vh] justify-center"
    />
  );
}
