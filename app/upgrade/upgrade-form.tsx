"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";
import type { AddonKey } from "@/lib/billing/plan";

export type BaseOption = {
  lookupKey: string;
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
  label: string;
  description: string;
};

export type AddonOption = BaseOption & { key: AddonKey };

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

export function UpgradeForm({
  base,
  addons,
}: {
  base: BaseOption;
  addons: AddonOption[];
}) {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Computed from the price data already on the page — no request per toggle.
  const total =
    base.unitAmount +
    addons.reduce(
      (sum, addon) => (enabled[addon.key] ? sum + addon.unitAmount : sum),
      0
    );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Add-on KEYS only. A client-supplied price id would be a pricing bypass.
      const selected = addons
        .filter((addon) => enabled[addon.key])
        .map((addon) => addon.key);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons: selected }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]"
    >
      <motion.div
        variants={fadeUp}
        className="flex items-start justify-between gap-4 pb-5"
      >
        <div>
          <p className="font-medium text-foreground">{base.label}</p>
          <p className="mt-1 text-sm text-muted">{base.description}</p>
        </div>
        <p className="shrink-0 text-sm font-medium text-foreground">
          {formatMoney(base.unitAmount, base.currency)}
          <span className="text-muted">/{base.interval}</span>
        </p>
      </motion.div>

      <div className="border-t border-border pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Add-ons
        </p>

        <div className="mt-4 space-y-4">
          {addons.map((addon) => (
            <motion.div
              key={addon.key}
              variants={fadeUp}
              className="flex items-start justify-between gap-4"
            >
              <label htmlFor={`addon-${addon.key}`} className="cursor-pointer">
                <span className="font-medium text-foreground">{addon.label}</span>
                <span className="mt-1 block text-sm text-muted">
                  {addon.description}
                </span>
              </label>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-muted">
                  {formatMoney(addon.unitAmount, addon.currency)}/{addon.interval}
                </span>
                <Switch
                  id={`addon-${addon.key}`}
                  checked={enabled[addon.key] ?? false}
                  onCheckedChange={(checked) =>
                    setEnabled((prev) => ({ ...prev, [addon.key]: checked }))
                  }
                  disabled={submitting}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        variants={fadeUp}
        className="mt-6 flex items-center justify-between border-t border-border pt-5"
      >
        <span className="font-medium text-foreground">Total</span>
        <span className="text-lg font-semibold text-foreground">
          {formatMoney(total, base.currency)}
          <span className="text-sm font-normal text-muted">
            /{base.interval}
          </span>
        </span>
      </motion.div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <motion.div variants={fadeUp}>
        <Button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {submitting ? "Redirecting to checkout…" : "Continue to checkout"}
        </Button>
      </motion.div>

      <p className="mt-3 text-center text-xs text-muted">
        Secure checkout powered by Stripe. Cancel any time.
      </p>
    </motion.form>
  );
}
