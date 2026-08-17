"use client";

import { ErrorState } from "@/components/layout/error-state";

/**
 * `getCatalog()` throws deliberately when a Stripe price is missing — a
 * silently-absent price must never produce a half-priced checkout. Without a
 * boundary that surfaced as a bare 500.
 *
 * No branching on `error.message`: Next redacts server-component error messages
 * in production, so message-matched copy would only ever render in development.
 * One honest message, with the real detail logged and shown in dev only.
 */
export default function UpgradeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <ErrorState
        logLabel="[upgrade]"
        title="Plans aren't available right now"
        description="This is on us, not you. Please try again in a moment — you haven't been charged."
        error={error}
        retry={retry}
        homeHref={null}
        className="py-0"
      />
    </main>
  );
}
