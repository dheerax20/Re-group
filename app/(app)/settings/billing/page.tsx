import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { syncCurrentUser } from "@/lib/auth/session";
import { getCatalog, toDisplayPrice } from "@/lib/billing/catalog";
import {
  activeAddonKeys,
  getActiveSubscription,
  listEntitlements,
} from "@/lib/billing/entitlements";
import {
  ADDONS,
  ADDON_KEYS,
  ALL_PLAN_KEYS,
  BASE,
  featureKeyForPlan,
} from "@/lib/billing/plan";
import { AddonManager, type ManagedAddon } from "./addon-manager";
import { ManageBillingButton } from "./manage-billing-button";

export const metadata = {
  title: "Billing — Regroup",
  description: "Manage your plan and add-ons.",
};

type StatusTone = "success" | "warning" | "destructive" | "secondary";

const STATUS_COPY: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trialing", tone: "success" },
  past_due: { label: "Past due", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "destructive" },
};

/**
 * Entitlements are stored under internal feature keys. Showing a church
 * "regroup_base via base" is leaking a database column into a billing screen,
 * so keys are resolved back to the product name they were granted for.
 */
const FEATURE_LABELS = new Map(
  ALL_PLAN_KEYS.map((planKey) => [
    featureKeyForPlan(planKey),
    planKey === "base" ? BASE.label : ADDONS[planKey].label,
  ])
);

export default async function BillingSettingsPage() {
  const user = await syncCurrentUser();

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
    label: subscription.status.replace(/_/g, " "),
    tone: "secondary" as StatusTone,
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
          className="mb-6 rounded-panel border border-warning/40 bg-warning-soft p-5"
        >
          <h2 className="font-medium text-warning">
            {subscription.status === "past_due"
              ? "Your last payment didn't go through"
              : "Your subscription is unpaid"}
          </h2>
          <p className="mt-1 text-sm text-warning/80">
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

      <Card padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{BASE.label}</CardTitle>
              <Badge variant={status.tone} dot>
                {status.label}
              </Badge>
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
          <p className="tabular shrink-0 text-sm font-medium text-foreground">
            ${(basePrice.unitAmount / 100).toFixed(0)}
            <span className="text-muted">/{basePrice.interval}</span>
          </p>
        </div>
      </Card>

      <div className="mt-6">
        <AddonManager addons={addons} />
      </div>

      <Card padding="lg" className="mt-6">
        <CardTitle className="text-base">Active features</CardTitle>
        {entitlements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No active features. If you just made a change, this updates within a
            few seconds.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {entitlements.map((entitlement) => (
              <li
                key={entitlement.id}
                className="flex items-center gap-2 text-sm"
              >
                <Badge variant="success" dot>
                  On
                </Badge>
                <span className="text-foreground">
                  {FEATURE_LABELS.get(entitlement.featureKey) ?? entitlement.featureKey}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Features follow your payments automatically, so this stays correct even
          if a card later fails.
        </p>
      </Card>

      <Card padding="lg" className="mt-6">
        <CardTitle className="text-base">Payment &amp; invoices</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Update your card, download invoices, or cancel your plan.
        </p>
        <ManageBillingButton className="mt-4" />
      </Card>
    </div>
  );
}
