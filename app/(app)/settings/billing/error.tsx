"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Billing settings can fail for the same reason `/upgrade` can — a missing
 * Stripe catalog — and this page is also the only recovery route for a
 * past_due customer, so it must never dead-end on a raw 500.
 */
export default function BillingSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[settings/billing]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-lg font-semibold text-foreground">
          Couldn&rsquo;t load your billing details
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your subscription is unaffected — this is a display problem on our
          side. Try again, and if it persists contact support.
        </p>

        {process.env.NODE_ENV !== "production" ? (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted">
            {error.message}
          </pre>
        ) : null}

        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
