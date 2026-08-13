"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * `getCatalog()` throws deliberately when a Stripe price is missing — a
 * silently-absent price must never produce a half-priced checkout. Without a
 * boundary that surfaced as a bare 500, hiding a message that names the exact
 * fix.
 */
export default function UpgradeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[upgrade]", error);
  }, [error]);

  /**
   * No branching on `error.message` here: Next redacts server-component error
   * messages in production, so any message-matched copy would only ever render
   * in development — misleading to write and misleading to read. One honest
   * message, with the real detail shown in dev only.
   */
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-lg font-semibold text-foreground">
          Plans aren&rsquo;t available right now
        </h1>
        <p className="mt-2 text-sm text-muted">
          This is on us, not you. Please try again in a moment — you haven&rsquo;t
          been charged.
        </p>

        {process.env.NODE_ENV !== "production" ? (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-background p-3 text-left text-xs text-muted">
            {error.message}
          </pre>
        ) : null}

        <Button onClick={reset} className="mt-6 w-full">
          Try again
        </Button>
      </div>
    </main>
  );
}
