"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2000;
/** After this long, stop waiting on the webhook and sync from Stripe directly. */
const FALLBACK_AFTER_MS = 5000;
const GIVE_UP_AFTER_MS = 20000;

/**
 * Bridges the gap between the Checkout redirect and the webhook.
 *
 * Since Basil, Checkout postpones subscription creation until after payment
 * completes, so arriving here before entitlements exist is the normal case,
 * not an error.
 */
export function FinalizingSubscription({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = React.useState(false);
  /**
   * Bumped by "Check again". It is in the effect deps, so incrementing it
   * restarts the polling loop.
   *
   * Without this the timeout state was terminal: polling had stopped, the deps
   * `[sessionId, router]` never change (Next memoizes the router instance), and
   * a still-not-ready server re-render RECONCILES this component rather than
   * remounting it — so `timedOut` stayed true and the button did nothing at all.
   */
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let fallbackRequested = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;

      if (elapsed > GIVE_UP_AFTER_MS) {
        setTimedOut(true);
        return;
      }

      try {
        const params = new URLSearchParams({ session_id: sessionId });
        // Ask for the direct-from-Stripe sync exactly ONCE, after the webhook
        // has had a fair chance. Requesting it on every subsequent tick would
        // fire a full Stripe retrieve plus a full sync every 2 seconds.
        const askingForFallback = elapsed > FALLBACK_AFTER_MS && !fallbackRequested;
        if (askingForFallback) params.set("fallback", "1");

        const response = await fetch(`/api/billing/status?${params}`);
        const payload = await response.json();

        // Spend the one-shot fallback only on a response we actually got.
        // Marking it used before the request meant a single transient failure
        // burned it — and the fallback exists precisely for the case where the
        // webhook never arrives, so losing it strands the user.
        if (askingForFallback && response.ok) fallbackRequested = true;

        if (!cancelled && payload.ready) {
          /**
           * Ask the server to re-render, but KEEP POLLING.
           *
           * Returning here used to end the loop permanently: the effect deps
           * never change, so nothing restarted it. If the refreshed render was
           * still not-ready — the webhook genuinely still in flight — this
           * component stayed mounted with polling dead, the timeout never
           * fired, and the user watched an eternal spinner.
           *
           * When the server does flip, this component unmounts and the cleanup
           * below cancels the loop.
           */
          router.refresh();
        }
      } catch {
        // Transient — the next tick retries.
      }

      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, router, attempt]);

  if (timedOut) {
    return (
      <div className="w-full max-w-md rounded-panel border border-border bg-surface p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-lg font-semibold text-foreground">
          This is taking longer than expected
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your payment went through, but we haven&rsquo;t finished setting up
          your account. This usually resolves on its own within a minute.
        </p>
        <button
          type="button"
          onClick={() => {
            // Restart polling, not just a one-off refresh: the refresh alone
            // leaves this component mounted and the loop dead if the server is
            // still not ready.
            setTimedOut(false);
            setAttempt((n) => n + 1);
            router.refresh();
          }}
          className="mt-6 text-sm text-brand underline"
        >
          Check again
        </button>
        <p className="mt-4 text-xs text-muted">
          If it persists, contact support — you will not be charged twice.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full max-w-md rounded-panel border border-border bg-surface p-8 text-center shadow-[var(--shadow-soft)]"
    >
      <div
        aria-hidden
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand"
      />
      <h1 className="mt-5 text-lg font-semibold text-foreground">
        Finalizing your subscription…
      </h1>
      <p className="mt-2 text-sm text-muted">
        Payment received. We&rsquo;re activating your features — this only takes
        a moment.
      </p>
    </div>
  );
}
