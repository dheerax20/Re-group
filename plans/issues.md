# Known Issues — Stripe Subscription + Add-ons Module

Findings from reviews of the billing work implemented against
`stripe-addons-implementation-plan-revised.md` (Phases 1–9).

**Status: sections A and B are FIXED and verified. C, D, E remain open.**

Each fix was reviewed by an independent subagent, which found genuine defects in
the fixes themselves — those are recorded below too, because the pattern matters:
the first attempt at B1 merely *moved* the bug from a 2.5s window to a 20s one.

| Section | Meaning | Status |
|---|---|---|
| **A** | Money/data correctness | ✅ fixed + verified |
| **B** | User-visible flow bugs | ✅ fixed + verified |
| **C** | Robustness / operational | ✅ fixed + unverified |
| **D** | Unnecessary or over-complicated code | ⬜ open |
| **E** | Known gaps and deliberate deviations | ⬜ open |

---

## ✅ A. Money / data correctness — FIXED

### A1 — Raising a price silently de-entitled every subscriber
`lib/billing/sync.ts` · **fixed**

Plan identity no longer comes from the mutable `price.lookup_key`. It is stamped
into immutable price **metadata** (`regroup_plan_key`) at catalog bootstrap and
persisted on the new `SubscriptionItem.planKey` column. `lookupKey` is retained
but demoted to informational, and nothing reads it for behaviour.

**Verified by performing a real rotation** with `transfer_lookup_key: true`:

```
old price lookup_key is now: (REMOVED — this is what broke A1)
old price still has metadata plan key: website
AFTER: items: base(...), website(no-key), automations(...)
       entitlements: ghl_automations, regroup_base, website_builder
PASS: website add-on survived the price rotation
```

Follow-on fixes from review:
- `npm run billing:backfill` — `planKey` was added nullable, so existing rows
  stayed NULL until their next webhook, which reproduced A1 on deploy.
- The bootstrap now stamps **every** price on a product, not just the one
  holding the lookup key — after a rotation that is the *new* price, while
  subscribers reference the old one.
- A NULL `planKey` now **fails safe**: `resolveContext()` returns 409 rather
  than letting the UI append a duplicate paid item.

### A2 — Reconcile sync could overwrite newer state
`lib/billing/sync.ts` · **fixed**. `syncSubscriptionFromStripe(id, { eventCreatedAt? })`
captures `fetchedAt` before the Stripe read and uses it as the staleness
yardstick when there is no event timestamp. Verified: a reconcile against a
newer watermark returns `{synced:false, reason:"stale_event"}`.

### A3 — `lastEventAt` poisoned with wall-clock time
`lib/billing/sync.ts` · **fixed**. Written only when `eventCreatedAt` is present
(conditional spread, so the `create` branch is covered too). Verified: watermark
unchanged after a reconcile.

### A4 — Entitlement revocation was user-wide; lock guarded the wrong scope
`lib/billing/sync.ts` · **fixed**. The advisory lock is keyed on `userId` (the
actual write target), and entitlements are recomputed as the union across ALL of
the user's entitled subscriptions. Verified: syncing a canceled subscription left
the live one's three entitlements intact — this previously wiped them.

### A5 — A single failed renewal was an unrecoverable dead end
**fixed**. Added `POST /api/billing/portal` (Customer Portal), a portal
configuration created by the bootstrap, and a `past_due`/`unpaid` banner with an
"Update payment method" button on `/settings/billing`. Verified: portal session
created, 401 unauthenticated, all banner elements render under `past_due`.

### A6 — A webhook event could be lost permanently
`app/api/stripe/webhook/route.ts` · **fixed**. `ProcessedStripeEvent.completedAt`
distinguishes a *claim* from a *completion*. Verified all four cases: fresh event
completes; redelivery is a duplicate; an abandoned claim is reprocessed; a recent
incomplete claim returns 409 so Stripe retries.

Follow-on fixes from review: `update` → `upsert` (a concurrent delete threw P2025
out of a catch block); `ABANDONED_CLAIM_MS` 2min → 5min (the real worst case is
~125s, so a live handler could have its claim stolen); and `no_billing_customer`
no longer marks completion — it releases the claim and returns 500, since that is
the one path where the work genuinely did not happen.

---

## ✅ B. User-visible flow bugs — FIXED

### B1 — Stale toggle state could add a duplicate paid item
`app/(app)/settings/billing/addon-manager.tsx` · **fixed, on the second attempt**

`desired` now adopts server truth during render, and a fixed 2.5s refresh was
replaced by an `applying` state that polls until the server reflects the change,
with all controls locked.

**The first attempt was incomplete** and the reviewer caught it: at the 20s
timeout it released `applying` without resetting `desired`, so `dirty` stayed
true with controls unlocked — rendering "Review changes" beneath "Changes
applied", the identical failure merely delayed. The panel now stays **locked** on
timeout and offers only "Reload to check".

### B2 — In-flight preview could resurrect a stale quote
**fixed**. A `previewGeneration` ref discards superseded responses; switches are
disabled while quoting. Review follow-ups: the render-time adoption path now also
bumps the generation (via an effect — mutating a ref during render is unsafe
under concurrent rendering), and `setQuoting(false)` is unconditional, since
guarding it could strand the panel permanently disabled.

### B3 — A card decline became permanently sticky
**fixed, with an important correction.** Stripe caches error responses against an
idempotency key for **at least 24 hours** (confirmed in docs — the original note
said "5 minutes"), so retrying with the same `prorationDate`-derived key replayed
the failure.

The first attempt cleared the quote on *every* failure. The reviewer correctly
flagged that as a **new** duplicate-charge risk: a thrown fetch means the outcome
is UNKNOWN and the PATCH may have succeeded, and Stripe caches *successful*
responses against the key too — which is what makes a retry safe. Now: clear on a
definitive HTTP response, **keep** on network error.

### B4 — "Cancel" left a dead-end quote panel
**fixed**. `resetToServer()` clears quote, error, notice and resets `desired`.

### B5 — Onboarding spinner could hang forever
`app/onboarding/finalizing.tsx` · **fixed**. The poll no longer `return`s after
`router.refresh()`, so the timeout reliably fires. Review follow-ups: "Check
again" was inert (`timedOut` never reset and the effect never restarted) — it now
restarts polling via an `attempt` dep; and the one-shot fallback was marked spent
*before* its request, so a single transient failure burned it.

### B6 — `/api/billing/status` `ready` disagreed with the page gate
**fixed** alongside A2/A3 — now `ready: await hasBasePlan(user.id)`.

### Defense in depth added while fixing B

Every duplicate-item bug in this module has one shape: a stale local view says an
add-on is absent when Stripe has it, so `buildItems` appends an item with no
`id`. `dropAlreadyAppliedChanges()` now re-checks **live Stripe state** before
spending money, making the class structurally impossible regardless of what the
client or the database believe. Verified by deliberately corrupting the DB:

```
Stripe items before: 3
making the DB stale: deleting the website item row...
PATCH -> {"updated":false,"noop":true,"alreadyApplied":true}
Stripe items after:  3
PASS: no duplicate item created despite the stale DB
```

---

## ⬜ C. Robustness / operational — OPEN

### C1 — `getCurrentUser` throws when documented as never throwing
`lib/auth-temp/index.ts` — its doc says it never throws, but `parseSigned` →
`sign` → `signingSecret()` throws when `AUTH_TEMP_SECRET` is unset. Any request
carrying a session cookie against a deploy missing that var 500s on every page
rendered through `requireUser()`, instead of degrading to logged-out.

### C2 — Raw `error.message` is returned to clients on 500
`app/api/billing/checkout/route.ts`, `addons/route.ts`, `addons/preview/route.ts`.
`getPriceByLookupKey` throws a message containing `` Run `npm run stripe:bootstrap` ``,
and Stripe SDK errors carry request ids and internal detail. `upgrade-form.tsx`
renders `payload.error` verbatim. Stripe's own security guidance is explicit that
errors must never carry internal detail. Log it, return a generic string.

### C3 — Production redirect target returns a JSON 404
`lib/auth-temp/index.ts` — `requireUser()` redirects to `/api/billing/dev-session`,
which 404s when `NODE_ENV === "production"`.

### C4 — `ProcessedStripeEvent` grows without bound
No pruning job. The `@@index([processedAt])` hints at the intent; nothing acts on
it. Needs a scheduled delete past Stripe's retry window (~30 days). Now slightly
more urgent: the A6 fix adds a `completedAt` column and keeps rows around as the
sole record of what has been handled.

### ~~C5 — `/api/billing/status` re-syncs on every poll~~ — FIXED
Fixed alongside A2/A3; the fallback now fires exactly once.

### C6 — `hashtext()` as the advisory lock key
`lib/billing/sync.ts` — undocumented internal Postgres function, and collisions
serialise unrelated users. Correct but accidental; use a deliberate stable hash.

### C7 — No error boundary for a missing Stripe catalog
`getCatalog()` throws loudly by design, but `/upgrade` and `/settings/billing`
surface a raw 500. The thrown message is actionable; an `error.tsx` would show it.

### C8 — Bootstrap can create duplicate products
`scripts/bootstrap-stripe-catalog.ts` keys product identity off the price's
`lookup_key`. If a price is archived or loses its key, it creates a brand-new
product — this happened during implementation (two "Pro Plan" products). Same
root cause as A1: treating a mutable `lookup_key` as stable identity. Partially
mitigated (prices are validated and all prices on a product get stamped), but
product resolution itself is still lookup-key-driven.

### C9 — `invoice_payment.paid` is unhandled
`app/api/stripe/webhook/route.ts` — a Dahlia-era event type absent from plan
§7.3. Harmless today (correctly 200-ignored, `invoice.paid` still fires) but the
ignore is incidental rather than deliberate.

### C10 — A2's guard compares two different clocks *(new, from review)*
`lib/billing/sync.ts` — `eventCreatedAt` is Stripe's clock at event creation;
`fetchedAt` is local wall clock at the Stripe read. The documented A2 race is
closed, but a narrower window survives: a webhook created at E and processed at
E+Δ writes `lastEventAt = E` while holding state read at E+Δ, so a reconcile
whose `fetchedAt` falls in (E, E+Δ) passes the guard. With the host clock behind
Stripe's, a fresh reconcile is also spuriously rejected. Exact fix: persist "when
the written state was read from Stripe" as its own column.

### C11 — The A4 union makes stale rows sticky *(new, from review)*
`lib/billing/sync.ts` — the old per-subscription revocation was blunt but
self-healing. Now a subscription whose terminal webhook was permanently lost
keeps DB status `active` and keeps granting features through the union
indefinitely, since nothing revisits it. Correct trade for A4, but it raises the
value of a periodic reconcile job (none exists; relates to C4).

---

## ⬜ D. Unnecessary or over-complicated — OPEN

- **D1 — `Entitlement.expiresAt` is a dead field with a dead branch.**
  `hasFeature()` reads and branches on it; `sync.ts` never writes it. Worse,
  `listEntitlements()` ignores it while `hasFeature()` honours it, so the two
  read paths will disagree the moment anyone adds trials.
- **D2 — `invalidateCatalogCache()` is never called.** Dead code.
- **D3 — Two Stripe round trips per save.** `PATCH /api/billing/addons` re-runs
  `invoices.createPreview` purely to test the sub-minimum threshold. Now three,
  with `dropAlreadyAppliedChanges()` added — correct, but worth documenting or
  consolidating.
- **D4 — Sentinel-string hack.** Was `notIn: [...] : [""]`; now a conditional
  spread in `sync.ts`. Largely resolved, worth a final pass.
- **D5 — Hand-rolled error union.** `ContextError` / `isContextError()` in
  `lib/billing/addons.ts`.
- **D6 — `dev-session` route misfiled under billing.** It is authentication; it
  lives there only to satisfy the plan's directory allow-list.

---

## ⬜ E. Known gaps and deliberate deviations — OPEN

| # | Item |
|---|---|
| E1 | **Declined-card path still unverified.** The test attempt netted $0 proration so the sub-minimum fallback fired and no charge was attempted. Needs a proration above ~$0.50. B3 sits on this path. |
| E2 | **Failed renewal → `past_due` → revoke unverified.** Needs a test clock. A5's recovery UI is verified, but the transition into `past_due` is not. |
| E3 | **`/onboarding` polling path never exercised end-to-end.** The webhook won the race on every local run — which is why B5 and B6 survived testing in the first place. |
| E4 | *Deviation:* preview/PATCH accept an **array** of add-on changes; plan §8 specifies a single add-on. |
| E5 | *Deviation:* schema applied with `db push`, not migrations. Billing tables have **no migration history** — now including `planKey` and `completedAt`. |
| E6 | **No `.env.example`.** `.gitignore` is `.env*`. `AUTH_TEMP_SECRET` and `STRIPE_WEBHOOK_SECRET` are undocumented for a new developer. |
| E7 | **No unit tests.** All verification is live against Stripe test mode via throwaway scripts. |
| E8 | **Stripe Tax deliberately off.** Prices carry `tax_behavior: "exclusive"`. Enabling it needs `automatic_tax`, `billing_address_collection`, the mandatory `customer_update` — **and an active tax registration**, without which Stripe silently collects nothing. |
| E9 | **`integration_identifier` not set on Checkout Sessions.** Stripe recommends it on `2026-03-25.dahlia`+ for tracking checkout flows in the Dashboard. |

---

## Operational runbook

Order matters — the backfill reads metadata the bootstrap writes.

```bash
npm run stripe:bootstrap   # create/stamp products, prices, features, portal config
npm run billing:backfill   # populate SubscriptionItem.planKey from price metadata
```

Run **both** after any manual price change in the Dashboard. A price created by
hand carries no `regroup_plan_key`, and `sync.ts` will log a loud warning and
grant nothing for it.

---

## Two API-version traps caught during implementation

Both fail silently — the request returns 200 and the field is simply `undefined`:

1. `subscription.current_period_start` / `current_period_end` **do not exist**.
   They live on `subscription.items.data[]`.
2. `invoice.subscription` **does not exist**. It is
   `invoice.parent.subscription_details.subscription`.

## Bugs found and fixed during implementation

- `sync.ts` used Prisma's 5s interactive-transaction default and failed with
  P2028 under load. `pg_advisory_xact_lock` blocks *inside* the transaction, so
  lock waiting counts against your own budget, and Stripe delivers ~5 events per
  checkout near-simultaneously. Fixed: 30s budget, `createMany` instead of
  per-row upserts.
