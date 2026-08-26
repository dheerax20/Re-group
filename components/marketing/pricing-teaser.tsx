import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { ADDONS, ADDON_KEYS, BASE } from "@/lib/billing/plan";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/motion-primitives";

/**
 * A pricing teaser, not a pricing page.
 *
 * The plan names and descriptions are read from `lib/billing/plan.ts` — the
 * same source the checkout and billing screens use — so this section cannot
 * drift from what a church is actually offered.
 *
 * Deliberately NO amounts. Prices live in Stripe and are resolved at runtime
 * (`lib/billing/catalog.ts`); printing a number here would either mean a Stripe
 * call on a public marketing page or a hardcoded figure that goes stale the
 * first time pricing changes. The real numbers are one click away on /upgrade.
 */
export function PricingTeaser() {
  const plans = [
    { key: BASE.featureKey, label: BASE.label, description: BASE.description, base: true },
    ...ADDON_KEYS.map((key) => ({
      key: ADDONS[key].featureKey,
      label: ADDONS[key].label,
      description: ADDONS[key].description,
      base: false,
    })),
  ];

  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28" id="pricing">
      <div className="mx-auto max-w-5xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[46px]">
            Simple pricing for
            <br />
            <span className="text-muted">growing churches.</span>
          </h2>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">
            Start with the base plan and add only what your church actually
            uses. Change or cancel whenever you like.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal delay={index * 0.06} key={plan.key}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6">
                {plan.base ? (
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-strong">
                    Everyone starts here
                  </span>
                ) : (
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                    Add-on
                  </span>
                )}
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                  {plan.label}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                  {plan.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8" delay={0.18}>
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface-muted/50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {["No setup fee", "Cancel anytime", "Free to start"].map((item) => (
                <li className="flex items-center gap-1.5 text-[14px] text-muted" key={item}>
                  <Check className="size-3.5 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="shrink-0 rounded-full" variant="outline">
              <Link href="/upgrade">
                View pricing
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
