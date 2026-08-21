"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AddonKey } from "@/lib/billing/plan";

export type ManagedAddon = {
  key: AddonKey;
  lookupKey: string;
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
  label: string;
  description: string;
  enabled: boolean;
};

type Quote = {
  dueToday: number;
  prorationDate: number;
  currency: string;
  noop: boolean;
};

/** How long to wait for the webhook to land before giving up on auto-refresh. */
const APPLY_TIMEOUT_MS = 20_000;
const APPLY_POLL_MS = 2_000;

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function signatureOf(addons: ManagedAddon[]): string {
  return addons.map((addon) => `${addon.key}:${addon.enabled}`).join(",");
}

function stateOf(addons: ManagedAddon[]): Record<AddonKey, boolean> {
  return Object.fromEntries(
    addons.map((addon) => [addon.key, addon.enabled])
  ) as Record<AddonKey, boolean>;
}

export function AddonManager({ addons }: { addons: ManagedAddon[] }) {
  const router = useRouter();

  const serverSignature = signatureOf(addons);

  /**
   * Identifies the in-flight preview. A response from a superseded request must
   * never populate the quote panel: it would describe a different change set
   * than the one now selected, and confirming it would charge an amount the
   * user was never shown.
   */
  const previewGeneration = React.useRef(0);

  const [desired, setDesired] = React.useState(() => stateOf(addons));
  const [adopted, setAdopted] = React.useState(serverSignature);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applyTimedOut, setApplyTimedOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  /**
   * Adopt server truth whenever it actually changes.
   *
   * Seeding `desired` once with `useState` left it permanently diverged from
   * the server after a save, so the form re-offered changes that had already
   * been applied — and confirming them a second time produced a fresh
   * prorationDate, a fresh idempotency key, and a DUPLICATE paid item.
   *
   * Adjusting state during render is React's recommended alternative to a
   * synchronising effect; it re-renders immediately without a browser paint.
   */
  if (serverSignature !== adopted) {
    setAdopted(serverSignature);
    setDesired(stateOf(addons));
    setQuote(null);
    setApplying(false);
    setApplyTimedOut(false);
  }

  /**
   * Every place that clears the quote must also supersede any in-flight
   * preview, or a late response repopulates it with a prorationDate computed
   * for a change set that no longer exists.
   *
   * `toggle()` and `resetToServer()` bump it directly; the adoption block above
   * cannot, because mutating a ref during render is unsafe under concurrent
   * rendering. This effect covers that third case — it runs long before any
   * network response could be processed.
   */
  React.useEffect(() => {
    previewGeneration.current += 1;
  }, [adopted]);

  /**
   * After a save, poll the server until it reflects the change rather than
   * refreshing once on a fixed timer that races the webhook. Toggles stay
   * locked throughout, so there is no window in which a duplicate submission
   * is even possible.
   */
  React.useEffect(() => {
    if (!applying) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    function tick() {
      if (cancelled) return;

      if (Date.now() - startedAt > APPLY_TIMEOUT_MS) {
        /**
         * Stop polling, but stay LOCKED.
         *
         * Releasing `applying` here would leave `dirty` true, `quote` null and
         * the controls enabled — rendering "Review changes" directly beneath
         * "Changes applied". Confirming again mints a new prorationDate, hence
         * a new idempotency key, hence a DUPLICATE paid item. That is the
         * original B1 failure, merely delayed by 20 seconds.
         *
         * Keeping `applying` true keeps the confirm path unreachable; the only
         * way forward is a reload, which re-derives everything from the server.
         */
        setApplyTimedOut(true);
        return;
      }

      router.refresh();
      timer = setTimeout(tick, APPLY_POLL_MS);
    }

    timer = setTimeout(tick, APPLY_POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [applying, router]);

  const changes = addons
    .filter((addon) => desired[addon.key] !== addon.enabled)
    .map((addon) => ({ addon: addon.key, enabled: desired[addon.key] }));

  const dirty = changes.length > 0;
  const locked = saving || applying;

  function toggle(key: AddonKey, checked: boolean) {
    // Supersede any in-flight preview.
    previewGeneration.current += 1;

    setDesired((prev) => ({ ...prev, [key]: checked }));
    setQuote(null);
    setError(null);
    setNotice(null);
  }

  function resetToServer() {
    previewGeneration.current += 1;
    setDesired(stateOf(addons));
    setQuote(null);
    setError(null);
    setNotice(null);
  }

  async function handleReview() {
    const generation = ++previewGeneration.current;
    setQuoting(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/addons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const payload = await response.json();

      // Superseded while in flight — discard.
      if (generation !== previewGeneration.current) return;

      if (!response.ok) {
        setError(payload.error ?? "Could not price these changes.");
        return;
      }
      setQuote(payload);
    } catch {
      if (generation === previewGeneration.current) {
        setError("Could not reach the server.");
      }
    } finally {
      /**
       * Unconditionally. Guarding this on the generation is only safe if every
       * superseding bump starts a replacement request — but `toggle()` and the
       * adoption block bump without one, which would strand `quoting` true
       * forever, permanently disabling the switches and the Review button with
       * no recovery but a reload. The generation guard belongs on `setQuote`
       * alone, where a stale value would actually be wrong.
       */
      setQuoting(false);
    }
  }

  async function handleConfirm() {
    if (!quote) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/addons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Echo the SAME prorationDate back so the charge matches the quote.
        body: JSON.stringify({ changes, prorationDate: quote.prorationDate }),
      });
      const payload = await response.json();

      if (!response.ok) {
        /**
         * Drop the quote on EVERY failure, not just a 409.
         *
         * The idempotency key is derived from the prorationDate. Stripe caches
         * a failed response against that key for at least 24 hours, so
         * retrying with the same quote replays the original failure — the
         * customer would keep seeing "declined" even after fixing their card.
         * Forcing a re-quote mints a new key and a genuine retry.
         */
        setQuote(null);
        setError(
          response.status === 409
            ? payload.error ?? "That quote expired. Please review again."
            : payload.error ?? "Could not apply these changes."
        );
        return;
      }

      setQuote(null);
      setNotice(
        payload.deferredToNextInvoice
          ? "Changes applied. The adjustment appears on your next invoice."
          : "Changes applied. Your features update in a moment."
      );

      // Entitlements are written by the webhook, so wait for the server to
      // actually reflect the change instead of assuming a fixed delay.
      setApplyTimedOut(false);
      setApplying(true);
    } catch {
      /**
       * KEEP the quote here — deliberately unlike the definitive-failure path
       * above.
       *
       * A thrown fetch means the outcome is UNKNOWN: the request may have
       * reached Stripe and succeeded before the connection dropped. Stripe
       * caches successful responses against the idempotency key too, which is
       * exactly what makes a retry safe. Clearing the quote would mint a new
       * prorationDate, hence a new key, hence no replay protection — and a
       * retry would append a second paid item.
       */
      setError(
        "We couldn't confirm whether that went through. Retry to check — " +
          "you won't be charged twice."
      );
    } finally {
      setSaving(false);
    }
  }

  const removingOnly = changes.length > 0 && changes.every((c) => !c.enabled);

  return (
    <section className="rounded-panel border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
      <h2 className="font-medium text-foreground">Add-ons</h2>
      <p className="mt-1 text-sm text-muted">Turn these on or off at any time.</p>

      <div className="mt-5 space-y-4">
        {addons.map((addon) => (
          <div key={addon.key} className="flex items-start justify-between gap-4">
            <label htmlFor={`manage-${addon.key}`} className="cursor-pointer">
              <span className="font-medium text-foreground">{addon.label}</span>
              <span className="mt-1 block text-sm text-muted">
                {addon.description}
              </span>
            </label>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm text-muted">
                {money(addon.unitAmount, addon.currency)}/{addon.interval}
              </span>
              <Switch
                id={`manage-${addon.key}`}
                checked={desired[addon.key]}
                onCheckedChange={(checked) => toggle(addon.key, checked)}
                // Also locked while quoting, so a toggle cannot race a preview.
                disabled={locked || quoting}
              />
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="mt-5 text-sm text-foreground">
          {notice}
        </p>
      ) : null}

      {quote ? (
        <div className="mt-5 rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-sm text-foreground">
            {quote.dueToday > 0 ? (
              <>
                Due today:{" "}
                <span className="font-medium">
                  {money(quote.dueToday, quote.currency)}
                </span>
              </>
            ) : quote.dueToday < 0 ? (
              <>
                Account credit:{" "}
                <span className="font-medium">
                  {money(Math.abs(quote.dueToday), quote.currency)}
                </span>
              </>
            ) : (
              "No charge today."
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {removingOnly
              ? "Removing an add-on issues an account credit toward your next invoice, not a refund to your card."
              : "Prorated for the remainder of the current billing period."}
          </p>
        </div>
      ) : null}

      {/* Committing on an explicit action rather than on switch flip — Stripe
          rate-limits frequent subscription updates. */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {applying ? (
          applyTimedOut ? (
            <div className="text-right">
              <p className="text-sm text-muted">
                Your changes were submitted but are taking longer than usual to
                appear.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-1 text-sm text-brand underline"
              >
                Reload to check
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Applying changes…</p>
          )
        ) : (
          <>
            {dirty && !quote ? (
              <Button onClick={handleReview} disabled={quoting}>
                {quoting ? "Calculating…" : "Review changes"}
              </Button>
            ) : null}

            {quote ? (
              <>
                <Button variant="outline" onClick={resetToServer} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {saving ? "Applying…" : "Confirm changes"}
                </Button>
              </>
            ) : null}

            {!dirty && !quote ? (
              <p className="text-sm text-muted">No pending changes</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
