# Implementation Plan: Stripe Subscription + Toggleable Add-ons

**Stack:** Next.js 16 (App Router) · Prisma ORM · Neon Postgres · Stripe Billing
**Stripe API version:** `2026-07-29.dahlia`
**Goal:** `/upgrade` page with one base plan and two independently toggleable recurring add-ons. On success → `/onboarding`. Add-ons can be added/removed at any time after purchase.

> **Revision note.** This supersedes an earlier draft that pinned `2025-06-30.basil`. That was wrong — Basil is two breaking-change generations behind current (Acacia → Basil → Clover → Dahlia). The Basil reference came from a docs note giving it as a *minimum* for flexible billing mode, which was misread as a recommendation. Also corrected: subscription period fields, checkout tax parameters, and webhook concurrency. See §13.

---

## 0. Guardrails — read before writing any code

These are hard constraints. Violating them is a failed implementation regardless of whether the feature works.

### 0.1 Do not touch the existing MVP

The app has a working MVP. This work is **strictly additive**.

- **Do not** modify, refactor, reformat, or "improve" any existing file except the four allow-listed below.
- **Do not** rename existing files, change existing exports, or reorganize existing directories.
- **Do not** upgrade or change versions of existing dependencies. Only *add* new ones.
- **Do not** touch existing Prisma models. Only append new models.

**The only pre-existing files you may modify:**

| File | Permitted change |
|---|---|
| `prisma/schema.prisma` | Append new models only. Do not edit existing models. |
| `package.json` | Add dependencies and scripts only. |
| `.env` / `.env.example` | Append new variables only. |
| `next.config.ts` | Only if strictly required; explain why before doing it. |

If you believe an existing file must change, **stop and ask** rather than changing it.

### 0.2 New code lives in isolated directories

```
app/upgrade/                    # new
app/onboarding/                 # new
app/api/billing/                # new
app/api/stripe/webhook/         # new
lib/billing/                    # new — all Stripe + entitlement logic
lib/auth-temp/                  # new — temporary user/session shim
prisma/migrations/              # new migration only
scripts/                        # new — catalog bootstrap script
```

Nothing outside these paths gets created or edited.

### 0.3 Verification gates

Stop at the end of each phase. Run the stated check. Report the result. Do not begin the next phase until the check passes.

---

## 1. Phase 1 — Dependencies and environment

### 1.1 Install

```bash
npm i stripe
```

Install the current `stripe` package (v22.4.x or later), whose own pinned API version is `2026-07-29.dahlia`. Do not add an auth library — the temporary user module is deliberately hand-rolled so it is trivial to delete later.

> **stripe-node v22 has breaking changes of its own.** All `decimal_string` fields changed type from `string` to `Stripe.Decimal`, and v22 moved TypeScript types inline. This build doesn't use decimal fields, but if TS complains about one, that's the cause.

### 1.2 Environment variables

Append to `.env` and `.env.example`:

```bash
# --- Stripe ---
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Neon (check whether these already exist before adding) ---
DATABASE_URL=postgresql://...-pooler.../db?sslmode=require   # pooled, for the app
DIRECT_URL=postgresql://.../db?sslmode=require               # direct, for migrations
```

**Neon note:** if `DIRECT_URL` is not already wired into the datasource block in `prisma/schema.prisma`, add it (`directUrl = env("DIRECT_URL")`). Migrations against the pooled endpoint fail or hang. If the existing datasource already has this, leave it alone.

**Price IDs are deliberately NOT env vars.** They resolve at runtime from Stripe `lookup_key`s (Phase 3). This avoids test/live drift and lets prices change without a redeploy.

### 1.3 Gate

`npm run build` still succeeds. No behavioural change to the app yet.

---

## 2. Phase 2 — Prisma schema

Append to `prisma/schema.prisma`. Do not modify anything already in the file.

```prisma
// ============================================================
// TEMPORARY USER MODULE
// Delete this entire block when the real auth/users module lands.
// Nothing in the billing module reads these tables directly —
// it only depends on a `userId: String`. See lib/auth-temp/README.md.
// ============================================================

model TempUser {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?

  onboardingCompletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions        TempSession[]
  billingCustomer BillingCustomer?
  entitlements    Entitlement[]

  @@map("tmp_users")
}

model TempSession {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user TempUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("tmp_sessions")
}

// ============================================================
// BILLING MODULE — permanent
// ============================================================

model BillingCustomer {
  id               String @id @default(cuid())
  userId           String @unique
  stripeCustomerId String @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user          TempUser       @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptions Subscription[]

  @@map("billing_customers")
}

enum SubscriptionStatus {
  incomplete
  incomplete_expired
  trialing
  active
  past_due
  canceled
  unpaid
  paused
}

model Subscription {
  id                   String @id @default(cuid())
  billingCustomerId    String
  stripeSubscriptionId String @unique

  status            SubscriptionStatus
  cancelAtPeriodEnd Boolean            @default(false)

  // NOTE: Stripe has no subscription-level period since Basil (see §5.1).
  // These are DERIVED from the base plan item and stored for convenient
  // querying only. items[].currentPeriodEnd is the authoritative value.
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?

  // Guard against out-of-order webhook delivery. Set from the event's
  // `created` timestamp. See §5.4 for why this alone is not sufficient.
  lastEventAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  billingCustomer BillingCustomer    @relation(fields: [billingCustomerId], references: [id], onDelete: Cascade)
  items           SubscriptionItem[]

  @@index([billingCustomerId])
  @@map("subscriptions")
}

model SubscriptionItem {
  id                       String @id @default(cuid())
  subscriptionId           String
  stripeSubscriptionItemId String @unique
  stripePriceId            String
  lookupKey                String
  quantity                 Int    @default(1)

  // Authoritative billing period — lives on the ITEM in Stripe, not the sub.
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@map("subscription_items")
}

// Denormalized read model. This is what the app gates features on —
// never query Stripe or Subscription/SubscriptionItem from UI code.
model Entitlement {
  id         String    @id @default(cuid())
  userId     String
  featureKey String
  source     String    // "base" | "addon_analytics" | "addon_support"
  grantedAt  DateTime  @default(now())
  expiresAt  DateTime?

  user TempUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, featureKey])
  @@index([userId])
  @@map("entitlements")
}

// Webhook idempotency. Stripe retries; handlers must be safe to re-run.
model ProcessedStripeEvent {
  id          String   @id            // the Stripe event id, evt_...
  type        String
  processedAt DateTime @default(now())

  @@index([processedAt])
  @@map("processed_stripe_events")
}
```

> **`@@unique([userId, featureKey])` means every product must grant a *distinct* feature key.** If the base plan and an add-on both granted `core_pro`, the second upsert would collide and `source` would be ambiguous on revoke. Keep the three feature keys disjoint.

### 2.1 Migrate

```bash
npx prisma migrate dev --name add_billing_and_temp_users
npx prisma generate
```

### 2.2 Gate

`npx prisma studio` shows the new tables. Existing tables untouched. Existing app routes still render.

---

## 3. Phase 3 — Stripe catalog bootstrap

Create `scripts/bootstrap-stripe-catalog.ts`. Idempotent — safe to re-run.

| Product | Price | Interval | `lookup_key` | Feature key |
|---|---|---|---|---|
| Pro Plan | $29 | month | `base_monthly` | `core_pro` |
| Advanced Analytics | $10 | month | `addon_analytics_monthly` | `advanced_analytics` |
| Priority Support | $15 | month | `addon_support_monthly` | `priority_support` |

Hard requirements:

- **All three prices share the same currency and the same `month` interval.** Stripe requires a single currency across a subscription's items (max 20 products per subscription). Mismatched intervals require flexible billing mode — out of scope, do not enable it.
- **`tax_behavior: "exclusive"`** on every price. This locks permanently once set; a mistake means creating a new price.
- **Create an Entitlements Feature per product and attach it:**
  ```ts
  const feature = await stripe.entitlements.features.create({
    name: "Advanced Analytics",
    lookup_key: "advanced_analytics",
  });
  await stripe.products.createFeature(productId, {
    entitlement_feature: feature.id,
  });
  ```
  These are **not** the "Feature list" marketing bullets on the product form — those are display-only and have no lookup key.
- **Idempotency:** look up by `lookup_key` first; only create if absent. Re-running must not duplicate.

> **Attach features before any subscription exists.** Attaching a feature to a product is not retroactive — existing subscriptions only gain the entitlement at the start of the next billing period. In a sandbox, just re-subscribe; in live, this is why catalog setup precedes launch.

Add to `package.json`: `"stripe:bootstrap": "tsx scripts/bootstrap-stripe-catalog.ts"`.

### 3.1 Gate

Run it twice. Second run creates nothing new. Dashboard shows 3 products, 3 prices, 3 features attached.

---

## 4. Phase 4 — Temporary auth shim

```
lib/auth-temp/
  index.ts        # getCurrentUser(), requireUser(), createDevSession()
  README.md       # how to rip this out
```

Requirements:

- `getCurrentUser(): Promise<TempUser | null>` — reads a signed session cookie, looks up `TempSession`, returns the user or null.
- `requireUser(): Promise<TempUser>` — throws/redirects if absent.
- In Next.js 16, request APIs are async. **`await cookies()`** — do not call it synchronously.
- A dev-only route or seed that creates a `TempUser` + session so `/upgrade` is testable. Gate behind `NODE_ENV !== "production"`.

**`README.md` must state:** the billing module depends only on a `userId: string` returned by `getCurrentUser()`. To swap in real auth, reimplement these two functions and backfill `tmp_users.id` → real user ids. No billing code changes.

Do **not** put `getCurrentUser` logic anywhere else. One pattern, one thing to replace.

### 4.1 Gate

A dev session cookie yields a user in a server component.

---

## 5. Phase 5 — Billing core

```
lib/billing/
  stripe.ts        # singleton Stripe client, pinned apiVersion
  catalog.ts       # lookup_key → price id resolution, cached
  plan.ts          # BASE / ADDONS constants, feature keys
  sync.ts          # Stripe subscription → DB (the ONLY writer to billing tables)
  entitlements.ts  # read helpers: hasFeature(userId, key)
```

### 5.1 `stripe.ts`

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
});
```

> **⚠️ There is no `subscription.current_period_end`.** Basil removed `current_period_start` and `current_period_end` from the Subscription resource; items now track their own billing periods. Read `subscription.items.data[n].current_period_start` / `.current_period_end` instead. This still holds on Dahlia.
>
> The failure mode is silent: the request returns 200, the object serializes fine, and the field is simply `undefined`. Reading it writes nulls into your `Subscription` rows and your renewal logic quietly stops working. Derive the subscription-level values from the base plan item.

Also note: `previous_attributes` on `customer.subscription.updated` now includes item billing-period changes, so this event fires more often than you might expect. For price or quantity changes, inspect `previous_attributes.items.data[].price`. Since `sync.ts` re-reads full state from Stripe rather than diffing the payload, this is harmless — but don't build logic on the assumption that the event only fires for meaningful changes.

### 5.2 `plan.ts`

```ts
export const BASE = {
  lookupKey: "base_monthly",
  featureKey: "core_pro",
} as const;

export const ADDONS = {
  analytics: { lookupKey: "addon_analytics_monthly", featureKey: "advanced_analytics", label: "Advanced Analytics" },
  support:   { lookupKey: "addon_support_monthly",   featureKey: "priority_support",  label: "Priority Support"  },
} as const;

export type AddonKey = keyof typeof ADDONS;
export const isAddonKey = (v: unknown): v is AddonKey =>
  typeof v === "string" && v in ADDONS;
```

### 5.3 `catalog.ts`

Resolves `lookup_key` → price id via `stripe.prices.list({ lookup_keys, active: true })`. Cache in module scope with a short TTL. Throw loudly on a missing key — a silently-missing price must not produce a half-priced checkout.

When you later raise prices, create the new price and move the key with `transfer_lookup_key: true`. Lookup keys are unique per mode, so the Dashboard will otherwise reject the duplicate.

### 5.4 `sync.ts` — the single writer

```ts
syncSubscriptionFromStripe(stripeSubscriptionId: string, eventCreatedAt?: Date)
```

1. `stripe.subscriptions.retrieve(id, { expand: ["items.data.price"] })`
2. Resolve `BillingCustomer` by `stripeCustomerId`. If absent, log and return — do not create one here.
3. Open a `prisma.$transaction` and **`SELECT ... FOR UPDATE` on the `Subscription` row** (raw query, since Prisma has no first-class row lock). This serializes concurrent webhook handlers for the same subscription.
4. Inside the lock, skip if `eventCreatedAt < subscription.lastEventAt`.
5. Upsert `Subscription`; replace `SubscriptionItem` rows to exactly mirror Stripe; recompute `Entitlement` rows; set `lastEventAt`.
6. Derive `Subscription.currentPeriodStart/End` from the item matching `BASE.lookupKey`.
7. Entitlements granted only when status is `active` or `trialing`. Any other status → revoke all.

> **The lock matters.** Without it, two events processed concurrently can both retrieve fresh state and both write, with the slower writer committing older data. The `lastEventAt` check alone doesn't prevent this — it's checked before the write but outside any mutual exclusion. Take the lock first, then check.

**Never write billing tables from anywhere else.** Route handlers call Stripe and return; the webhook calls `sync.ts`.

### 5.5 Gate

Unit-test `sync.ts` against mocked Stripe subscription objects: base only, base+1, base+2, canceled. Assert item-level period fields are read correctly.

---

## 6. Phase 6 — `/upgrade` page

```
app/upgrade/page.tsx           # server component: auth check, current state
app/upgrade/upgrade-form.tsx   # client component: toggles, total
app/api/billing/checkout/route.ts
```

### 6.1 Behaviour

- Server component calls `requireUser()`. Redirect unauthenticated users to the dev login.
- **If the user already has an active subscription, redirect to the add-on management screen** (Phase 8), not checkout.
- Client renders base plan (always on, not toggleable) + two add-on switches. Total updates from static price data — no API call per toggle.
- Submit → `POST /api/billing/checkout` → `{ url }` → `window.location.href = url`.

### 6.2 `POST /api/billing/checkout`

```ts
export const runtime = "nodejs";
```

1. `requireUser()`.
2. Body: `{ addons: string[] }`. **Filter through `isAddonKey`.** The client sends *keys*, never price ids. Reject anything unrecognized.
3. Get-or-create `BillingCustomer` (`stripe.customers.create` + persist).
4. Resolve price ids from `catalog.ts`.
5. Create the session:

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: billingCustomer.stripeCustomerId,
  line_items: [
    { price: basePriceId, quantity: 1 },
    ...addonPriceIds.map(price => ({ price, quantity: 1 })),
  ],
  client_reference_id: user.id,
  subscription_data: { metadata: { userId: user.id } },

  // US sales tax
  automatic_tax: { enabled: true },
  billing_address_collection: "required",
  customer_update: { address: "auto", name: "auto" },

  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade?canceled=1`,
  allow_promotion_codes: true,
});
```

Three things doing real work:

- **`customer_update` is mandatory** when passing an existing `customer` alongside `automatic_tax`. Without it Checkout cannot persist the collected address and the session errors outright. Most common Stripe Tax integration failure.
- **`billing_address_collection: "required"`** — US sales tax stacks state, county, city, and district rates. A ZIP alone is insufficient.
- **`subscription_data.metadata.userId`** is how the webhook maps a subscription back to a user without depending on session state.

If Stripe Tax isn't enabled in your sandbox yet, omit the three tax lines; adding them later is a two-line change.

Use **hosted** Checkout (redirect), not embedded — with embedded, changing a toggle after mount forces session recreation. A side benefit: you never load Stripe.js, so Dahlia's breaking Elements/Stripe.js changes don't apply to you.

### 6.3 Gate

Toggling produces correct line items in the Dashboard for all four combinations.

---

## 7. Phase 7 — Webhook

`app/api/stripe/webhook/route.ts`

```ts
export const runtime = "nodejs";   // REQUIRED — signature verification needs Node crypto
export const dynamic = "force-dynamic";
```

### 7.1 Signature verification

```ts
const body = await req.text();                      // raw string, never req.json()
const sig = req.headers.get("stripe-signature")!;
const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
```

**Next.js 16 gotcha:** if the project has (or later adds) a `proxy.ts` — Next 16's replacement for `middleware.ts`, exporting a `proxy` function — Next buffers and clones the request body so it can be read twice, governed by `proxyClientMaxBodySize`. Any transformation of the body breaks signature verification. **Exclude `/api/stripe/webhook` from the proxy `matcher`.** If the project has no proxy/middleware file, do not create one.

### 7.2 Idempotency

Before handling: `INSERT` into `ProcessedStripeEvent` with the event id. On unique-constraint violation, return `200` immediately — already handled.

### 7.3 Events to handle

| Event | Action |
|---|---|
| `checkout.session.completed` | If `mode === "subscription"`, `syncSubscriptionFromStripe(session.subscription)` |
| `customer.subscription.created` | sync |
| `customer.subscription.updated` | sync — the add-on toggle path |
| `customer.subscription.deleted` | sync — status `canceled`, revoke entitlements |
| `invoice.payment_failed` | sync (status → `past_due`) |
| `invoice.paid` | sync |

Optionally also `entitlements.active_entitlement_summary.updated`. Treat it as a reconciliation cross-check, not the source of truth — `sync.ts` derives entitlements from price IDs itself, so a feature misconfiguration won't break access.

### 7.4 Response discipline

Return `200` for anything you successfully processed **or deliberately ignore**. Return `4xx`/`5xx` only on genuine failure. Non-2xx for unhandled event types triggers endless retries and eventual endpoint disabling.

### 7.5 Gate

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Complete a real test checkout with both add-ons. Verify: 1 `Subscription`, 3 `SubscriptionItem` rows with non-null period dates, 3 `Entitlement` rows. Then `stripe events resend evt_xxx` — no duplicates.

---

## 8. Phase 8 — Add-on management after purchase

**Critical constraint:** Stripe's Customer Portal cannot update a subscription that has multiple products — the customer can cancel but not modify. **You must build this screen.** Use the portal only for payment methods, invoices, and cancellation.

Create `app/settings/billing/page.tsx` — but **confirm the existing route convention first, do not invent one that clashes**.

### 8.1 `POST /api/billing/addons/preview`

```ts
const prorationDate = Math.floor(Date.now() / 1000);

const preview = await stripe.invoices.createPreview({
  customer: customerId,
  subscription: sub.stripeSubscriptionId,
  subscription_details: {
    items: enabling
      ? [{ price: priceId, quantity: 1 }]
      : [{ id: existingItemId, deleted: true }],
    proration_date: prorationDate,
  },
});

const dueToday = preview.lines.data
  .filter(l => l.parent?.subscription_item_details?.proration)
  .reduce((sum, l) => sum + l.amount, 0);
```

Filter on `parent.subscription_item_details.proration` — `preview.total` includes the next renewal charge and would badly overstate what's due now. Return `{ dueToday, prorationDate, currency }`.

### 8.2 `PATCH /api/billing/addons`

Client echoes back the `prorationDate` from the preview.

```ts
await stripe.subscriptions.update(sub.stripeSubscriptionId, {
  items: enabling
    ? [{ price: priceId, quantity: 1 }]
    : [{ id: existingItemId, deleted: true }],
  proration_behavior: enabling ? "always_invoice" : "create_prorations",
  proration_date: prorationDate,
  payment_behavior: "error_if_incomplete",
}, {
  idempotencyKey: `addon:${sub.stripeSubscriptionId}:${addonKey}:${enabling}:${prorationDate}`,
});
```

Required rules:

- **Verify ownership first.** Load the subscription via the authenticated user's `BillingCustomer`, never from a client-supplied subscription id. Return `403` on mismatch.
- **Reject a stale `prorationDate`** (older than ~5 minutes) with `409`. Stripe computes the real proration at the passed date; a stale one means quote and charge diverge. Passing the same date to both preview and update is what makes them match exactly.
- **`items` is a partial update** — send only the item being changed. Untouched items are preserved.
- `always_invoice` on add charges immediately. The default `create_prorations` would grant access now and bill in three weeks.
- `create_prorations` on remove issues an account credit, not a card refund. Say so in UI copy.
- `error_if_incomplete` surfaces a declined card as an error instead of a subscription stuck in `incomplete`.
- **Sub-minimum proration:** if `dueToday` is below Stripe's minimum charge (~50 cents USD), `always_invoice` fails. Fall back to `create_prorations` and tell the user it appears on their next invoice.
- **Do not flip entitlements here.** Return success; `customer.subscription.updated` calls `sync.ts`. Update UI optimistically, then reconcile.
- **Debounce.** Stripe rate-limits frequent subscription updates. Commit on an explicit "Save changes" action.

### 8.3 Gate

Preview amount matches the actual charge exactly. Entitlement appears/disappears within seconds of the webhook.

---

## 9. Phase 9 — `/onboarding`

`app/onboarding/page.tsx`

- `requireUser()`.
- **Do not trust `session_id` in the URL as proof of payment.** Read entitlements from the DB.
- **Expect a race.** Since Basil, Checkout postpones subscription creation until *after* the customer completes payment — so the redirect frequently beats both subscription creation and webhook delivery. This is normal, not a bug to engineer away.
  - Entitlements exist → render onboarding.
  - Not yet → render "Finalizing your subscription…" and poll a lightweight `GET /api/billing/status` every ~2s for ~20s.
  - Fallback: if `session_id` is present and polling is still empty after ~5s, retrieve the session server-side once and call `syncSubscriptionFromStripe` directly. Idempotent, so harmless.
  - After timeout, show a support message, not an infinite spinner.
- On completion set `onboardingCompletedAt`.
- A user with no active subscription landing here → redirect to `/upgrade`.

### 9.1 Gate

Dev login → `/upgrade` → toggle both → `4242 4242 4242 4242` → lands on `/onboarding` → renders, possibly after a brief polling state.

---

## 10. Phase 10 — Testing

Cards: success `4242 4242 4242 4242` · 3DS `4000 0025 0000 3155` · declines `4000 0000 0000 9995` · attaches then fails on charge `4000 0000 0000 0341`.

Anything involving time uses **Simulations** (test clocks): Dashboard → Billing → Subscriptions → Simulations. Advance the clock a few minutes between API calls on the same subscription or you'll hit rate limits, since the subscription is frozen at the clock's time.

- [ ] Checkout: base only / base+analytics / base+support / base+both
- [ ] Webhook replay → no duplicate rows
- [ ] Out-of-order webhook (older `created`) → does not clobber newer state
- [ ] Two webhooks delivered concurrently → row lock serializes them correctly
- [ ] `SubscriptionItem.currentPeriodEnd` is non-null after checkout (catches the Basil field trap)
- [ ] Add add-on mid-cycle *(simulation)* → immediate prorated charge, quote matches charge
- [ ] Remove add-on mid-cycle *(simulation)* → credit issued, entitlement revoked
- [ ] Add near period end *(simulation)* → sub-minimum fallback fires cleanly
- [ ] Failed renewal *(simulation)* → `past_due` → entitlements revoked
- [ ] Add → remove → add same add-on → no orphaned `SubscriptionItem` rows
- [ ] Declined card on add (`4000 0000 0000 0341`) → clean error, subscription unchanged, no entitlement
- [ ] Cancel → all entitlements revoked
- [ ] `/upgrade` with an existing active subscription → redirects, no second subscription
- [ ] `POST /api/billing/checkout` with a raw price id in the payload → rejected
- [ ] `PATCH /api/billing/addons` for another user's subscription → `403`
- [ ] Stale `prorationDate` (>5 min) → `409`
- [ ] `/onboarding` with webhook delayed → polling resolves

---

## 11. Handoff notes for the real users module

Written to `lib/auth-temp/README.md`:

1. Billing code touches `TempUser` in exactly one place: `getCurrentUser()` / `requireUser()`. Everything downstream consumes `userId: string`.
2. To migrate: create the real user table, backfill `tmp_users.id` as the new ids (or add a mapping column), repoint the FKs on `billing_customers` and `entitlements`, reimplement the two functions, delete `lib/auth-temp/` and the `tmp_*` models.
3. `stripeCustomerId` lives on `BillingCustomer`, not on the user — so the user table can be replaced without touching Stripe.

---

## 12. Decisions already made — do not relitigate

| Decision | Reason |
|---|---|
| Multi-item single subscription, not multiple subscriptions | One invoice, one payment, one renewal date |
| Hosted Checkout, not embedded | Embedded requires session recreation on every toggle change; also avoids Stripe.js entirely |
| Own toggle UI, not Stripe `optional_items` | Full control of upgrade-page presentation |
| Custom add-on management screen, not Customer Portal | Portal cannot update multi-product subscriptions |
| Client sends add-on **keys**, server resolves price ids | Client-supplied price ids are a pricing-bypass vulnerability |
| `lookup_key` resolution, not env-var price ids | No redeploy on price change; no test/live drift |
| Webhook is the sole entitlement writer | Prevents DB/Stripe divergence on failed payments and Dashboard-side edits |
| `always_invoice` on add, `create_prorations` on remove | Charge now for access now; credit rather than refund on removal |
| Same `proration_date` for preview and update | The only way quote and charge match exactly |

---

## 13. Changes from the previous draft

| # | Change | Why |
|---|---|---|
| 1 | API version `2025-06-30.basil` → `2026-07-29.dahlia` | Basil is two breaking-change generations old. The Basil reference was a stated *minimum* for flexible billing mode, misread as a recommendation. |
| 2 | Period fields resolved, not flagged for later | `current_period_start/end` were removed from Subscription in Basil and live on items. Previously left as "verify this"; now specified, with item-level columns added to the schema. |
| 3 | Added `automatic_tax`, `billing_address_collection`, `customer_update` to Checkout | Genuine omission. `customer_update` is mandatory with `automatic_tax` + an existing customer, and its absence errors the session outright. |
| 4 | Added row-lock requirement in `sync.ts` | `lastEventAt` alone doesn't prevent concurrent handlers from both retrieving fresh state and the slower one committing stale data. |
| 5 | Idempotency key uses `prorationDate`, not `sub.current_period_start` | The old key referenced a field that no longer exists — it would have been `undefined` in every key. |
| 6 | Added ownership check to `PATCH /api/billing/addons` | Was only in the test checklist, never stated as a requirement. |
| 7 | Noted features are not retroactive | Attaching a feature after subscriptions exist grants nothing until the next billing period. |
| 8 | Onboarding race reframed as expected | Checkout postpones subscription creation until after payment completes, so the redirect routinely arrives first. |
| 9 | Testing phase now uses Simulations | Sub-minimum proration and renewal cases are impractical to test by hand. |
| 10 | Noted `@@unique([userId, featureKey])` requires disjoint feature keys | Shared keys across products would collide on upsert. |
