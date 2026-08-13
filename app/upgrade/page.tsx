import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-temp";
import { getCatalog, toDisplayPrice } from "@/lib/billing/catalog";
import { getActiveSubscription } from "@/lib/billing/entitlements";
import { ADDONS, ADDON_KEYS, BASE } from "@/lib/billing/plan";
import { UpgradeForm, type AddonOption, type BaseOption } from "./upgrade-form";

export const metadata = {
  title: "Upgrade — Regroup",
  description: "Choose your Regroup plan and add-ons.",
};

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const user = await requireUser();

  // One subscription per user. Sending someone with an active subscription
  // through Checkout again would create a second one — a support nightmare.
  const existing = await getActiveSubscription(user.id);
  if (existing) redirect("/settings/billing");

  const { canceled } = await searchParams;

  // Prices come from Stripe, never from constants — raising a price must not
  // require a redeploy. Throws loudly if the catalog is missing.
  const catalog = await getCatalog();

  const base: BaseOption = {
    ...toDisplayPrice(catalog.get(BASE.lookupKey)!),
    label: BASE.label,
    description: BASE.description,
  };

  const addons: AddonOption[] = ADDON_KEYS.map((key) => ({
    key,
    ...toDisplayPrice(catalog.get(ADDONS[key].lookupKey)!),
    label: ADDONS[key].label,
    description: ADDONS[key].description,
  }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Choose your plan
          </h1>
          <p className="mt-2 text-sm text-muted">
            Start with everything you need to publish your church website. Add
            extras any time — or remove them later.
          </p>
        </div>

        {canceled ? (
          <div
            role="status"
            className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted"
          >
            Checkout was canceled. Nothing has been charged.
          </div>
        ) : null}

        <UpgradeForm base={base} addons={addons} />

        <p className="mt-6 text-center text-xs text-muted">
          Signed in as {user.email}
        </p>
      </div>
    </main>
  );
}
