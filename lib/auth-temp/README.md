# `lib/auth-temp` — delete me when real auth lands

This directory is a placeholder. It exists only so the billing module has a
stable user identity to attach Stripe customers and entitlements to, without
this MVP having to grow authentication first.

It is **not** authentication. There is no password, no verification, no CSRF
protection, and the only way to create a session is a dev-only route that is
disabled in production. Do not build on it.

## The contract

The billing module depends on exactly one thing: a `userId: string`.

It gets that from two functions in `index.ts`:

```ts
getCurrentUser(): Promise<TempUser | null>
requireUser():    Promise<TempUser>        // redirects when absent
```

Every downstream consumer — `lib/billing/*`, the checkout route, the webhook,
the add-on management screen — only ever reads `user.id` and passes it around
as a string. Nothing outside this directory imports `TempUser` for its own
sake, and nothing outside this directory reads the session cookie.

## How it works

- A `TempSession` row is created with a 30-day expiry.
- The cookie `regroup_temp_session` holds `<sessionId>.<hmac-sha256>`, signed
  with `AUTH_TEMP_SECRET`. The signature is verified before the id is used in
  a query, so a tampered cookie never reaches the database.
- `createDevSession()` throws if `NODE_ENV === "production"`, and the route
  that calls it (`/api/billing/dev-session`) returns 404 there as well.

## Getting a session in development

```
http://localhost:3000/api/billing/dev-session
```

Creates (or reuses) `dev@regroup.test`, sets the cookie, and redirects to
`/upgrade`. Override with query params:

```
/api/billing/dev-session?email=someone@example.com&next=/settings/billing
```

## Replacing this with real auth

1. Implement `getCurrentUser()` and `requireUser()` against the real session
   source. Keep the signatures — return something with an `id: string`.
2. Backfill `tmp_users.id` values as the ids in the new user table, or add a
   mapping column, then repoint the foreign keys on `billing_customers` and
   `entitlements`.
3. Delete this directory, the `/api/billing/dev-session` route, the `TempUser`
   and `TempSession` models in `prisma/schema.prisma`, and `AUTH_TEMP_SECRET`
   from `.env`.

**No billing code changes.** `stripeCustomerId` lives on `BillingCustomer`,
not on the user, so the user table can be swapped without touching Stripe.

## Note on the existing `/login` page

`app/(auth)/login` and its siblings are visual mockups — they call
`router.push()` and discard the submitted values. They are unrelated to this
shim and were deliberately left untouched. When real auth arrives, that page
is where it should be wired in.
