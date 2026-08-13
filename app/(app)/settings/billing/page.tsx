import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-temp";
import { getCatalog, toDisplayPrice } from "@/lib/billing/catalog";
import {
  activeAddonKeys,
  getActiveSubscription,
  listEntitlements,
} from "@/lib/billing/entitlements";
import { ADDONS, ADDON_KEYS, BASE } from "@/lib/billing/plan";
import { AddonManager, type ManagedAddon } from "./addon-manager";
import { ManageBillingButton } from "./manage-billing-button";

export const metadata = {
  title: "Billing — Regroup",
  description: "Manage your plan and add-ons.",
};

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-emerald-100 text-emerald-800" },
  trialing: { label: "Trialing", tone: "bg-emerald-100 text-emerald-800" },
  past_due: { label: "Past due", tone: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Unpaid", tone: "bg-red-100 text-red-800" },
};

export default async function BillingSettingsPage() {
  const user = await requireUser();

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) redirect("/upgrade");

  const [catalog, entitlements] = await Promise.all([
    getCatalog(),
    listEntitlements(user.id),
  ]);

  const enabled = new Set(activeAddonKeys(subscription));

  const addons: ManagedAddon[] = ADDON_KEYS.map((key) => ({
    key,
    ...toDisplayPrice(catalog.get(ADDONS[key].lookupKey)!),
    label: ADDONS[key].label,
    description: ADDONS[key].description,
    enabled: enabled.has(key),
  }));

  const basePrice = toDisplayPrice(catalog.get(BASE.lookupKey)!);
  const status = STATUS_COPY[subscription.status] ?? {
    label: subscription.status,
    tone: "bg-neutral-100 text-neutral-800",
  };

  const renewsOn = subscription.currentPeriodEnd;

  // past_due / unpaid revoke entitlements but keep the subscription live, so
  // this screen is the only route back to a working account.
  const needsPayment =
    subscription.status === "past_due" || subscription.status === "unpaid";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Billing"
        description="Manage your plan and add-ons. Changes take effect immediately."
      />

      {needsPayment ? (
        <section
          role="alert"
          className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"
        >
          <h2 className="font-medium text-amber-900">
            {subscription.status === "past_due"
              ? "Your last payment didn't go through"
              : "Your subscription is unpaid"}
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            Your features are paused until a payment succeeds. Update your card
            and Stripe will retry automatically.
          </p>
          <ManageBillingButton
            label="Update payment method"
            variant="default"
            className="mt-4"
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-foreground">{BASE.label}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{BASE.description}</p>
            {renewsOn ? (
              <p className="mt-2 text-xs text-muted">
                {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
                {renewsOn.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-sm font-medium text-foreground">
            ${(basePrice.unitAmount / 100).toFixed(0)}
            <span className="text-muted">/{basePrice.interval}</span>
          </p>
        </div>
      </section>

      <div className="mt-6">
        <AddonManager addons={addons} />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <h2 className="font-medium text-foreground">Active features</h2>
        {entitlements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No active features. If you just made a change, this updates within a
            few seconds.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {entitlements.map((entitlement) => (
              <li key={entitlement.id} className="text-sm text-muted">
                <span className="text-foreground">{entitlement.featureKey}</span>{" "}
                <span className="text-xs">via {entitlement.source}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Features are granted by Stripe webhooks, not by this page — so they
          stay correct even if a payment later fails.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <h2 className="font-medium text-foreground">Payment & invoices</h2>
        <p className="mt-1 text-sm text-muted">
          Update your card, download invoices, or cancel your plan.
        </p>
        <ManageBillingButton className="mt-4" />
      </section>

      <div className="mt-6 flex justify-end">
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
