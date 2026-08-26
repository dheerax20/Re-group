"use client";

import { ErrorState } from "@/components/layout/error-state";

/**
 * Billing settings can fail for the same reason `/upgrade` can — a missing
 * Stripe catalog — and this page is also the only recovery route for a
 * past_due customer, so it must never dead-end on a raw 500.
 */
export default function BillingSettingsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      logLabel="[settings/billing]"
      title="We couldn't load your billing details"
      description="Your subscription is unaffected — this is a display problem on our side. Try again, and contact us if it keeps happening."
      error={error}
      retry={retry}
    />
  );
}
