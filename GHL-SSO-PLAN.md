# GHL OIDC SSO — setup plan

Source material: the GHL "Single Sign-On (SSO)" docs pasted into this
conversation (Navigation and Access → FAQs). This file cross-references that
doc against what's actually implemented in this repo today, and lays out what
setting up real SSO requires — on GHL's side, on our side, and in code.

## Where things stand right now

- `app/(app)/(dashboard)/courses/page.tsx` provisions the GHL account
  (`ensureGhlAccount`) then does `redirect(COURSES_SSO_URL)` — a **static**
  URL, no token, no query params.
- `.env.example` shows `COURSES_SSO_URL=https://app.squibb.ink/login/sso`.
  That exactly matches the doc's documented Redirect URL pattern —
  `https://<your-whitelabel-domain>/login/sso` — so `app.squibb.ink` is
  GHL's whitelabel domain for this agency, and this URL is almost certainly
  the correct SSO entry point already. **No code change needed here.**
- There is currently **no OIDC implementation anywhere in this repo** — no
  Clerk-side "OAuth Application"/IdP registration, no token exchange, nothing.
  The static redirect only works today because GHL's own `/login/sso` page
  does the whole OIDC handshake itself once configured in the GHL dashboard —
  it is not something this app drives.
- `ghl.md`'s own architecture sketch (top of that file) already names this
  destination: `GHL Sub-account → OIDC SSO → Auth0 → Same SaaS User`. Read
  "Auth0" there as "Clerk" now — the diagram's shape is exactly what this plan
  implements, it was just never built.

## Critical mismatch found

`lib/ghl/provision.ts:189` sends:

```ts
externalUserId: user.id,   // our internal Regroup User.id (cuid)
```

Per the pasted doc: *"HighLevel matches users based on their `externalUserId`
(Remote ID)"* and Remote ID is mapped, in GHL's SSO config, to the OIDC `sub`
claim the IdP returns at login. **If Clerk is the IdP, the `sub` Clerk hands
back is the Clerk user id (`user_...`), i.e. `User.clerkId` in our schema —
not `User.id`.**

As written, every provisioned GHL user's Remote ID will never match what
Clerk asserts at SSO login time. Per the doc's own "Behind the scenes"
section, GHL falls back to matching by `email + companyId` when Remote ID
doesn't match — so login would still work today by lucky coincidence (emails
line up), but the doc's whole "why this matters" point — email changes in the
IdP still resolve correctly — silently stops applying, and the "No user found
with this email" failure mode becomes reachable if a Clerk user ever changes
their email.

**Fix required before enabling SSO:** change line 189 to
`externalUserId: user.clerkId`. (Not applied yet — this plan only documents
it; flagging separately since it's a one-line, low-risk change that should
probably land before or alongside the GHL-side config, not after.)

## Prerequisites (per the doc)

- [ ] Agency on the $497 (Agency Pro) plan — `ghl.md` already notes this plan
      requirement for the Locations API, so it's likely already satisfied.
- [ ] Whitelabel domain configured — appears to already be `app.squibb.ink`.
- [ ] Labs → enable "Single Sign On (SSO)" feature flag (only needed before
      Nov 3; auto-enabled after).

## Open question: can Clerk act as the OIDC Identity Provider here?

GHL's "Provider-Specific Guides" cover Auth0, Azure AD, and Okta — all
generic OIDC IdPs with an "app registration" concept that yields a Client
ID/Secret and a `/.well-known/openid-configuration` URL. Clerk has an
equivalent: **Clerk's "OAuth Applications" feature**, which lets a Clerk
instance act as an OIDC provider for third-party services (exposing
`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`, and its own
`/.well-known/openid-configuration`).

**This needs to be verified in the Clerk dashboard before proceeding** — confirm
the plan/tier this Clerk project is on actually has "OAuth Applications"
available, since it gates the entire rest of this plan. If it isn't
available, the fallback would be standing up a small custom OIDC provider
wrapping Clerk sessions — meaningfully more work, out of scope for this plan
until the Clerk-native path is ruled out.

## Setup steps

### 1. Clerk side — register GHL as an OAuth Application

- Clerk Dashboard → OAuth Applications → create one for HighLevel.
- Request scopes: `openid profile email` (per the doc's recommendation —
  `profile` and `email` beyond the mandatory `openid`).
- Note the issued Client ID / Client Secret, and the discovery URL
  (`https://<clerk-frontend-api>/.well-known/openid-configuration`).
- Add the GHL Redirect URL (`https://app.squibb.ink/login/sso`) to the
  application's allowed redirect URIs — this is the one HighLevel prefills
  and that must be whitelisted on the IdP side per the doc.

### 2. HighLevel side — Company Settings → Single Sign-On (SSO)

Following the doc's Step 1–4:

- **Step 1**: paste the Clerk OAuth Application's Client ID and Secret.
  Auth method is locked to OIDC — nothing to choose.
- **Step 2**: "Use OIDC Config URL" → Yes → paste Clerk's discovery URL
  (automatic discovery, recommended over manual endpoint entry). Scopes:
  `openid profile email`. Leave the Redirect URL as GHL prefills it — should
  already read `https://app.squibb.ink/login/sso`; per the doc, don't edit
  unless it's wrong.
- **Step 3** — User Details Mapping:
  | GHL field | Value | Source |
  |---|---|---|
  | Remote ID Field (required) | `sub` | Clerk's OIDC subject claim = `clerkId` |
  | ID Field (optional) | leave unset | we don't need direct GHL-user-id mapping |
  | Email Field | `email` | Clerk's `email` claim, requires `email` scope |
  | Email Verified Field (required) | `email_verified` | Clerk's `email_verified` claim, requires `email` scope |
- **Step 4**: review, save.

### 3. Test (mandatory before the SSO toggle can turn on)

- Company Settings → SSO → "Start Test" (or the "Test Configuration" menu
  item).
- First test attempt may land on a login screen even if you're normally
  signed in — the doc calls this expected on a first visit / after logout,
  and says it doesn't invalidate the test result.
- A successful test is required before the "Enable SSO" toggle becomes
  available. Do this in an incognito window as a second pass, to confirm
  genuine SSO (not a stale GHL session cookie) — this also answers the
  "was the earlier auto-login real SSO or a stale cookie" question from
  before this doc existed.

### 4. Enable

- Flip the SSO toggle on for the agency.
- Optionally enable "Hide other login options" (Email/Google) — only usable
  once SSO itself is on.

## Known limitation to design around

Per the doc: **"New users cannot sign up with SSO — they must already exist
in HighLevel."** This is already handled correctly by the existing flow —
`courses/page.tsx` calls `ensureGhlAccount(user.id)` (which creates the GHL
location + user via the Create Users API) *before* redirecting to the SSO
URL, so by the time a user's browser reaches `/login/sso`, the GHL account
already exists for that `externalUserId` (once the fix above lands) to match
against.

## Fallout if the config is later edited

Per the doc: editing the SSO config after a passing test **expires the test
and disables SSO by default** until re-tested and re-enabled. Worth knowing
before touching the Clerk Client ID/Secret or scopes later — it's not a
silent no-op, it turns SSO off agency-wide until someone re-runs the test.
