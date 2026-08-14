"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Opens the Stripe Customer Portal. Payment methods, invoices, cancellation —
 * everything the add-on screen deliberately does not handle.
 */
export function ManageBillingButton({
  label = "Manage payment methods & invoices",
  variant = "outline",
  className,
}: {
  label?: string;
  variant?: "outline" | "default";
  className?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not open the billing portal.");
        setLoading(false);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button variant={variant} onClick={open} disabled={loading}>
        {loading ? "Opening…" : label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
