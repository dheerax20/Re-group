# Slackbot — Alpha Plan

Let a church owner connect their own Slack workspace to Regroup, **pick one
channel during the install**, and from that channel — and only that channel —
edit their generated website by running `/regroup <prompt>`.

> Plan only — no code written yet. Branch: `feat/slackbot`.
> Originally written 2026-08-17 at `eff9370`. **Revised 2026-08-23** against the
> current tree: the block rewrite, the tRPC layer and Trigger.dev all landed
> after the first draft, and a connection-only Slack integration shipped in
> between. Background reading: `README.md` (current), `CLAUDE.md` (the
> non-negotiables every step below has to satisfy). `website_builder_ai.md` and
> `template_working.md` predate the block rewrite — don't trust them.

---

## 1. Why this document was rewritten

The goal is unchanged. The implementation is substantially different, because
three things happened after `eff9370`:

1. **Connection-only Slack already shipped.**
   `lib/slack/{api,actions,crypto,state}.ts`,
   `app/api/slack/oauth/callback/route.ts`,
   `components/slack/slack-connect-panel.tsx`,
   `app/(app)/(paid)/dashboard/slack/page.tsx`, the `SlackConnection` model and
   its migration all exist. The README says so: *"Connection only, so far"*.
   The original plan's `SlackInstallation` model, `lib/slack/crypto.ts`,
   `lib/slack/client.ts` and its whole OAuth phase are **already built** — they
   need extending, not creating. What the current install does **not** do is
   pick a channel or record who installed it on the Slack side. **That gap is
   the centre of this work.**

2. **The content model changed.** `sectionConfig` is no longer the edit target.
   A page is a block tree: `Site.blockConfig` for `/`, a `SitePage` row for
   every other page. Everything the first draft said about `sectionConfig`,
   `coerceSections`, `previousSectionConfig` and `changedSectionIds` is wrong
   now. Undo has to snapshot **a page's block tree**, and it has to know *which*
   page.

3. **The AI edit path was already extracted and hardened.**
   `lib/ai/editor-prompt-service.ts` → `lib/ai/page-edit.ts` is the shared core
   the old Phase 3 asked for. The concurrency hazard (old D6) is **already
   fixed**: migration `20260819140000_one_active_job_per_site` created exactly
   the partial unique index the plan hand-wrote SQL for, and `claimJob`
   (`lib/ai/generation-job.ts`) turns the P2002 into "already running".
   Trigger.dev now runs the full build.

Net effect: eight phases collapse to seven smaller ones, one whole phase
(concurrency) disappears, and the undo design changes shape entirely.

---

## 2. The shape of it

Three constraints define this alpha:

1. **One bound channel.** The bot only accepts commands in a single channel,
   chosen by the installer from Slack's own picker during OAuth. Nowhere else —
   not other channels, not DMs.
2. **One bound editor.** The Slack identity that authorizes the install is
   bound to the Regroup account signed in at the time. That pairing *is* the
   account link; there is no separate linking flow.
3. **One undoable edit.** Each AI edit carries its own pre-edit page snapshot
   and can be reverted exactly once, within 15 minutes. Beyond that, the web
   editor.

The result is a narrow, auditable remote control for the existing editor prompt
— not a second editing surface. Slack is a new *caller* of the shared edit run,
never a new model path.

---

## 3. What "done" looks like

1. A signed-in site owner with the Slack add-on installs the app via OAuth,
   **picks a channel in Slack's install dialog**, and lands back on
   `/dashboard/slack` naming that channel. The `SlackConnection` row carries an
   encrypted bot token, the channel id, and both halves of the identity binding.
2. The bound owner types `/regroup make the hero warmer` in that channel and
   gets: an immediate ephemeral ack, then a visible channel message that updates
   in place with the AI's summary, which page changed, an open-improvements
   count, and **Open editor** / **View site** / **Undo** buttons.
3. That edit produced a `SiteGenerationJob` (`kind: "editor_prompt"`,
   `source: "slack"`) carrying its own pre-edit page snapshot, a repaired block
   write, and cache invalidation through `invalidateSite`.
4. **Undo** — button or `/regroup undo` — restores the pre-edit page once,
   removes the button, and refuses politely on a second attempt.
5. `/regroup status` reports draft/live state, the live URL, and the remaining
   monthly AI allowance.
6. Every rejection answers ephemerally and actionably: wrong channel, not the
   bound account, no add-on, plan lapsed, monthly cap, cooldown, edit already
   running, workspace uninstalled, bot removed from the channel.
7. Signature verification and the `SLACK_COMMANDS_ENABLED` kill switch both
   work, and `npm run verify` is green.

---

## 4. Scope

**In**

- Workspace install (OAuth v2, `incoming-webhook` channel picker) + uninstall.
- Identity binding at install time.
- One surface: `/regroup …` in the bound channel.
- Sub-commands: `help`, `status`, `undo`.
- One AI edit per prompt — the existing editor prompt run.
- Once-only undo within 15 minutes, snapshot stored on the job row.
- Block Kit replies in-channel; ephemeral errors via `response_url`.
- The existing `website_builder` add-on gating the whole feature.

**Out (explicitly, for alpha)**

- **DMs to the bot.** No `message.im`, no `im:history`. A DM is unaudited and
  invisible to the rest of the church; the bound channel is the point. It also
  means every casual "thanks!" would otherwise cost an LLM call.
- **`@Regroup` mentions.** No `app_mention`, no `app_mentions:read`. The slash
  command is the only entry point, which keeps parsing trivial and makes "did it
  hear me?" unambiguous.
- **Triggering a full six-agent build.** Six LLM calls and a minute-plus of
  work; the wizard owns it and it needs the progress UI to be legible.
- **Publishing / unpublishing.** A validated, gated, slug-claiming action is not
  a chat action.
- **Image uploads from Slack.** File handling plus the `mediaUrlSchema` https
  rule. Block images are URL-only today.
- **Multi-site or multi-user.** `Site.userId` is `@unique`; one workspace binds
  to one site. Do not design for more yet.
- **Undo in the web editor.** Snapshots are written on the web path from Phase 3
  and go unread there. Cheap follow-up, no schema change.
- Slack Connect, Enterprise Grid org installs, Socket Mode, Home tab.
- Notifications *out* of Regroup into Slack. Same plumbing, separate feature.

---

## 5. Decisions

| # | Decision | Chosen | Why / alternative rejected |
| --- | --- | --- | --- |
| **D1** | Where the edit runs after the 3s ack | A **Trigger.dev task** (`trigger/slack-edit.ts`) | `after()` from `next/server` is still exported in Next 16 and needs zero new infra — but a killed invocation leaves an ack with no result **and** a `QUEUED` row jamming the next edit, because the `STALE_JOB_MS` sweep was deliberately removed in favour of `reconcileJobWithRun`. Trigger.dev gives durability, `onFailure` (post the failure back), and matches where `full_build` already went. Cost: `trigger.dev deploy` per environment. |
| **D2** | Which AI path `/regroup <prompt>` uses | The **`editor_prompt`** path | The chatbot (`sendChatMessage`) would give free Q&A and shared history, but produces no `SiteGenerationJob` row — and that row is what undo hangs its snapshot off — and would interleave Slack into the web chat thread. |
| **D3** | Uninstall / revoke | **Delete** the `SlackConnection` row | A `revokedAt` column reads better as an audit trail, but `slackTeamId` is `@unique`, so a kept-but-revoked row permanently blocks that workspace from reconnecting. Deleting matches the existing `disconnectSlack`, giving one code path for disconnect / `app_uninstalled` / `tokens_revoked`. The audit trail lives on `SiteGenerationJob` (`source`, `slackUserId`). |
| **D4** | Binding model | Extend the existing **site-scoped `SlackConnection`** | The first draft's user-anchored `SlackInstallation`. `Site.userId` is `@unique`, so site-scoped and user-scoped are the same set — and the existing model is already wired into the UI, the OAuth callback and the README. |
| **D5** | Channel selection | Slack's own picker via the **`incoming-webhook`** scope, at install | A post-install picker on `channels:read` needs a second setup step and a broader consent screen. Confirmed against Slack docs: `incoming-webhook` "triggers a user-facing channel picker during the OAuth 2.0 installation sequence", and `oauth.v2.access` returns `incoming_webhook.channel_id` / `.channel`. We store the ids and **ignore the webhook URL** — webhook posts return no `ts`, so they cannot be `chat.update`d. |
| **D6** | Getting the bot into that channel | Request **`chat:write.public`** | Slack's docs are explicit: *"bot users cannot join channels independently and must be invited."* Relying on the install to seat the bot was a real risk, not something to discover mid-build. `chat:write.public` lets `chat.postMessage` post to **any public channel with no invite**. Rejected: `channels:join` + a `conversations.join` call — one more scope, one more failure point. |
| **D7** | Changing the bound channel later | **Reconnect to rebind** | An in-app picker on `channels:read` is deferred: broader consent screen, a paginated `conversations.list`, a new screen and its tests. The connect panel states the limitation plainly instead. |
| **D8** | Undo window | **15 minutes** from `finishedAt` | Without a window, someone clicks Tuesday's button on Thursday and silently discards two days of editor work. |
| **D9** | Plan gate | **The existing `website_builder` add-on ($29/mo)**, gating both connecting a workspace and running `/regroup`. SUPERSEDED a separate `slack_assistant` add-on — Slack is a second surface onto the AI editor that add-on already pays for, so billing twice for one capability was the wrong shape. Checked on every command, not once at connect, so a lapsed add-on closes the editor and Slack together. Note Slack shares the same `editor_prompt` monthly cap; it does not raise the allowance. | `hasBasePlan` alone (too permissive — no way to price the feature); a separate paid add-on (charges twice for one capability, and leaves a church able to hold Slack access without the editor it edits through). |
| **D10** | Slash command name | **`/regroup`** only | Reserving `/regroup-site` as well is cheap insurance, but collision risk is low in a church workspace; Slack rejects a duplicate at install and the manifest can change before wider rollout. |
| **D11** | Undo in the web editor | **Follow-up**, not this branch | Snapshots get written on the web path from Phase 3 and simply go unread (a few KB per job row). Keeps the diff off a surface churches use today. |
| **D12** | Feature flag | `SLACK_COMMANDS_ENABLED=1` gates the **command surface only** | The connect UI keeps its existing `isSlackConfigured()` gate, plus the new add-on check. Merging this changes nothing a church sees today. |
| **D13** | Apply vs confirm | Apply immediately + Undo + snapshot | Mirrors the web editor and keeps the alpha one round-trip. With one bound editor in the church's own channel there is no "someone edits a live site by accident" risk to design against. A confirm step needs a stored proposal and doubles the state machine. |
| **D14** | Where Slack edits land | The live site, same as the editor | A draft/publish split for Slack-only edits would make Slack behave differently from every other surface. Undo covers the risk. |

---

## 6. What is already built (do not rebuild)

| Need | Existing code | Status |
| --- | --- | --- |
| Token encryption at rest | `lib/slack/crypto.ts` (AES-256-GCM, `SLACK_TOKEN_ENCRYPTION_KEY`) | Done. Note the env var name — the first draft said `SLACK_TOKEN_ENC_KEY`. |
| OAuth `state` (CSRF + carries `siteId`) | `lib/slack/state.ts` (HMAC, 10-min TTL, stateless) | Done. Replaces the first draft's state-cookie design. |
| Slack API client, result objects not throws | `lib/slack/api.ts` (`call()`, `SlackResult<T>`, `explainSlackError`) | Done. Needs ~5 more methods. |
| OAuth callback | `app/api/slack/oauth/callback/route.ts` | Done. Needs channel + Slack-identity capture. |
| Connect / disconnect UI | `lib/slack/actions.ts`, `components/slack/slack-connect-panel.tsx`, `app/(app)/(paid)/dashboard/slack/page.tsx` | Done. Route is `/dashboard/slack`, **not** `/settings/slack`. |
| One active job per site — atomically | `claimJob` + migration `20260819140000_one_active_job_per_site` | **Done.** The first draft's hand-written partial index step is deleted entirely. |
| Budget + cooldown | `assertAiBudget` / `getAiBudget` (`lib/ai/usage.ts`) | Done. `getAiBudgetSummary` no longer exists — the first draft's reference is stale. Cooldown key is `ai:${kind}:${userId}`, so Slack and web share one cooldown for free. |
| One AI edit path | `runEditorPrompt` (`lib/ai/editor-prompt-service.ts`) → `runPageEdit` (`lib/ai/page-edit.ts`) | Done. Includes model retargeting to another page and per-call budget re-assertion. |
| Page read/write | `getPageBlocks` (`lib/site/blocks/resolve-page.ts`), `writePageBlocks` (`lib/ai/page-edit.ts`) | Done. **The only** legal way to touch a page tree. |
| Repair model output | `repairBlocks` / `coerceBlocks` (`lib/site/blocks/schema.ts`) | Done. Replaces `coerceSections` on this path. |
| Cache clearing | `invalidateSite` (`lib/site/invalidate.ts`) | Done. |
| Non-redirecting auth result | `authorizeSiteRequest` (`lib/auth/session.ts`) | The shape to copy for `authorizeSlackActor`. |
| Add-on catalog, checkout, entitlement sync | `lib/billing/plan.ts` (`ADDONS`), `lib/billing/addons.ts`, `lib/billing/sync.ts`, `/settings/billing` | Fully generic. A new add-on is one `ADDONS` entry + one seed amount; UI and checkout follow. |
| Raw-body webhook precedent | `/api/stripe/webhook` + its early return at the top of `proxy.ts` | The pattern to extend. The file is `proxy.ts` (Next 16), not `middleware.ts`. |
| Durable background work | `trigger/full-build.ts`, `trigger.config.ts` | The pattern for `trigger/slack-edit.ts`. |
| Mocked-Prisma guard tests | `tests/trpc-guards.test.ts` | The pattern for `tests/slack-authorize.test.ts`. |

---

## 7. Two bugs in shipped code to fix on the way through

Both would break the install flow:

1. **`isSlackConfigured()` does not check the encryption key.**
   `lib/slack/api.ts:12` requires `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`,
   `SLACK_SIGNING_SECRET` — but `encryptToken` throws when
   `SLACK_TOKEN_ENCRYPTION_KEY` is unset. A deployment with three of four vars
   advertises Connect and then throws mid-callback. Add the fourth var.

2. **The `redirect_uri` is built two different ways.** `lib/slack/actions.ts:19`
   uses `NEXT_PUBLIC_APP_URL`; `app/api/slack/oauth/callback/route.ts:52` uses
   `request.nextUrl.origin`. Slack requires the exchange `redirect_uri` to match
   the authorize one exactly — behind a tunnel or proxy these diverge and the
   exchange fails with `bad_redirect_uri`. Extract one `slackRedirectUri()`
   helper into `lib/slack/api.ts` and use it from both.

---

## 8. Data model

Additive only. **No hand-written index** — the one the first draft needed
already exists.

```prisma
model SlackConnection {
  // existing: id, siteId @unique, slackTeamId @unique, slackTeamName,
  //           botUserId, botAccessToken, installedByUserId, createdAt, updatedAt

  /// incoming_webhook.channel_id — the ONLY channel /regroup answers in.
  channelId        String?
  /// incoming_webhook.channel, e.g. "#website". Display only.
  channelName      String?
  /// authed_user.id from oauth.v2.access — the only Slack identity that may edit.
  ownerSlackUserId String?
  /// Granted bot scopes, so a stale install missing a scope is diagnosable.
  scopes           String  @default("")
}
```

All three are **nullable on purpose**: rows already exist from the shipped
connect-only flow. A row with a null `channelId` or `ownerSlackUserId` is a
*pre-alpha connection* — `authorizeSlackActor` refuses it with "reconnect Slack
to pick a channel", and the settings panel shows the same prompt. That is what
makes the migration safe with no backfill.

```prisma
model SiteGenerationJob {
  // …existing fields
  source             String    @default("web")   // "web" | "slack"
  slackChannelId     String?
  slackMessageTs     String?   // OUR message — what chat.update targets
  slackUserId        String?

  // Undo, in the block-tree world. Written in the SAME transaction as the page write.
  previousPath        String?   // which page the snapshot belongs to
  previousBlocks      Json?     // that page's pre-edit tree
  previousPageExisted Boolean?  // false = there was no SitePage row; undo deletes it
  previousStory       Json?     // improvements / designFeedback / mobileFeedback only
  writtenBlocksHash   String?   // sha256 of the tree as written
  revertedAt          DateTime?
  revertedBlocks      Json?     // what undo discarded — insurance, no redo UI
}
```

Three notes on the shape:

- **`slackMessageTs`, not a thread ts.** With mentions out of scope there is no
  thread to reply into. The only Slack timestamp we care about is our own
  message, because that is what `chat.update` targets.

- **`previousPageExisted` is the subtle one.** A never-edited secondary page has
  no `SitePage` row, and `getPageBlocks` recomputes its default from
  `brand`/`features` on every render (see the comment in `commitBuild`
  explaining why rows are not seeded at build time). The edit creates the row.
  If undo just wrote the old tree back, the page would stay frozen at that
  default forever. Recording `hasStoredPage(siteConfig, path)` before the edit
  lets undo `sitePage.delete` instead, returning the page to recomputing.

- **The snapshot lives on the job, not in a revisions table.** Once-only undo
  never reads history, so a history table would be write-only. The job row
  already exists per edit, already carries the Slack coordinates, and already
  has a lifecycle. **Snapshot columns are written on the web path too**, because
  the run is shared — a free foundation for editor undo later (D11).

**Migration:** one generated `ALTER TABLE` per model. `source` defaults to
`"web"`, correct for every existing row. Nothing to backfill, nothing
hand-written.

---

## 9. Routing and proxy

All routes `export const runtime = "nodejs"` (Prisma + `node:crypto`).

| Route | Method | Auth0 in `proxy.ts` | Purpose |
| --- | --- | --- | --- |
| `/api/slack/commands` | POST | **skipped** | `/regroup …` — form-encoded |
| `/api/slack/events` | POST | **skipped** | `url_verification`, `app_uninstalled`, `tokens_revoked` |
| `/api/slack/interactivity` | POST | **skipped** | Block Kit buttons — form-encoded `payload` |
| `/api/slack/oauth/callback` | GET | **required** | Reads the Auth0 session (exists today) |

`proxy.ts` currently early-returns for `/api/stripe/webhook` only. Replace that
single check with an exact-match set — **exact, never prefix**, or it would
swallow `/api/slack/oauth/callback`, which genuinely needs the session:

```ts
const RAW_BODY_WEBHOOKS = new Set([
  "/api/stripe/webhook",
  "/api/slack/commands",
  "/api/slack/events",
  "/api/slack/interactivity",
]);
if (RAW_BODY_WEBHOOKS.has(pathname)) return NextResponse.next();
```

Two load-bearing reasons: Slack signs the **raw body** (nothing may buffer or
re-encode it), and these requests carry no session and must not have cookies set
on them. `isPlatformPath` already covers `/api`, so there is no tenant-rewrite
risk; the early return exists for those two reasons only.

---

## 10. Implementation phases

Seven, each independently reviewable, each leaving `npm run verify` green.

### Phase 0 — Config hardening, billing catalog, proxy

**Files:** `lib/slack/api.ts`, `lib/billing/plan.ts`,
`scripts/bootstrap-stripe-catalog.ts`, `proxy.ts`, `.env.example`,
`tests/proxy-raw-body.test.ts`.

1. Fix both bugs in §7 (`isSlackConfigured` + `slackRedirectUri()`).
2. Add `isSlackCommandsEnabled()` =
   `isSlackConfigured() && SLACK_COMMANDS_ENABLED === "1"`.
3. **No new add-on (D9).** Slack rides on the existing `website_builder`
   entitlement — the same one the site editor needs — so `lib/billing/plan.ts`
   and `scripts/bootstrap-stripe-catalog.ts` are untouched and there is no
   `stripe:bootstrap` run to do. The three gates
   (`getSlackConnectionState`, the OAuth callback, `authorizeSlackActor`) all
   read `ADDONS.website.featureKey`.

   Worth knowing: nothing else in the codebase reads `website_builder` today,
   so Slack is its first consumer. A church holding the add-on gets Slack;
   one without it gets an upgrade prompt instead of a Connect button.

4. `RAW_BODY_WEBHOOKS` in `proxy.ts` (§9).
5. Add `SLACK_COMMANDS_ENABLED` to the existing `.env.example` Slack block
   (lines 102–122), and update the scope list in that comment to
   `commands, chat:write, chat:write.public, incoming-webhook`.
6. `tests/proxy-raw-body.test.ts` — the three webhook paths bypass the
   middleware, the OAuth callback does not. A one-line regression here would
   silently break signature verification for every request, so it gets a test
   before the code that depends on it exists.

**Done when:** the flag is off, nothing in the product mentions the command
surface, and `npm run verify` is green.

---

### Phase 1 — Request verification

**Files:** `lib/slack/verify.ts`, `tests/slack-verify.test.ts`.

`verifySlackRequest(request)` →
`{ ok: true; rawBody: string } | { ok: false; reason: string }`:

- `await request.text()` **first**. Never `.json()` / `.formData()` before
  verifying — both consume and re-encode the body.
- Require `x-slack-request-timestamp` and `x-slack-signature`; missing either is
  a failure.
- Reject when `Math.abs(now - ts) > 300` — **both directions**; a far-future
  timestamp is as suspicious as a stale one.
- Compute `"v0=" + hmacSha256(signingSecret, "v0:" + ts + ":" + rawBody)`.
- Compare with `crypto.timingSafeEqual` after a length check, because it throws
  on a length mismatch. `lib/slack/state.ts:verifyOAuthState` already does
  exactly this dance — copy it.
- On failure the caller returns 401 with an empty body. Log the reason
  server-side; never echo it to Slack.

Plus typed parsers that run **after** verification: `parseCommandBody(rawBody)`
(URL-encoded → `team_id`, `user_id`, `channel_id`, `text`, `response_url`) and
`parseEventBody(rawBody)` (JSON). Handle the Events API handshake: if
`type === "url_verification"`, return `{ challenge }`.

**No idempotency table.** The two subscribed events both do the same idempotent
thing (delete the connection), so a Slack retry is harmless. This deliberately
departs from the `ProcessedStripeEvent` claim-and-retry precedent: Stripe events
are replay-safe, so retrying is right there. An LLM edit is **not** replay-safe
— a re-run spends money and applies a second edit — so for anything that mutates
a site, failing closed beats retrying. Duplicate commands are handled by the
active-job index; duplicate undo clicks by `revertedAt`.

**Done when:** unit tests cover valid signature, tampered body, tampered
signature, stale timestamp, future timestamp, and each missing header.

---

### Phase 2 — Channel + owner binding

**This is the phase that delivers the headline feature: connect your own Slack
and choose the one channel `/regroup` runs in.**

**Files:** `lib/slack/api.ts`, `lib/slack/actions.ts`,
`app/api/slack/oauth/callback/route.ts`, `app/api/slack/events/route.ts`,
`prisma/schema.prisma`, one migration.

1. **Widen `OAUTH_SCOPES`** (`lib/slack/actions.ts:22`) to
   `["commands", "chat:write", "chat:write.public", "incoming-webhook"]`.
   `incoming-webhook` is what makes Slack render its channel picker inside the
   existing authorize screen — no second setup step, no custom UI, no
   `channels:read`. `chat:write.public` is what lets the bot actually post there
   without being invited (D6).

2. **Gate the Connect button on the add-on** (D9). `getSlackConnectionState`
   also returns `hasAddon: await hasFeature(userId, ADDONS.slack.featureKey)`.
   When false, the panel shows the add-on's price (via `getCatalog` /
   `toDisplayPrice`, the same helpers `/settings/billing` uses) and an
   "Add to plan" link, instead of Connect. `getSlackConnectionState` currently
   calls `requireOwnedSite`; the add-on read is a read, so that stays correct.

3. **Extend `exchangeOAuthCode`** to also return `authed_user.id`, `scope`, and
   the whole `incoming_webhook` object (`channel`, `channel_id`).
   Confirmed against Slack's docs: `authed_user.id` is present in **every**
   `oauth.v2.access` response, including when no user scopes are requested —
   only the nested `access_token`/`scope` require user scopes. So the
   one-bound-editor binding costs zero extra scopes.

4. **Callback route** — store `channelId`, `channelName`, `ownerSlackUserId`,
   `scopes` on the upsert, and re-check the add-on server-side (a browser can
   hit the callback directly). If `incoming_webhook` **or** `authed_user.id` is
   absent, redirect to `?slack=no_channel` rather than storing a half-bound row.
   Keep the existing `team_taken` guard and the existing session re-check —
   `ownerUserId` is derived from the **server session**, never a query
   parameter, and that rule is already honoured today.

5. **Add `authTest`** to `lib/slack/api.ts` and call it with the decrypted token
   as a smoke check before declaring success.

6. **Reconnect rebinds.** The existing `upsert` on `siteId` already handles
   this. Reconnecting is the supported way to change the channel or the bound
   Slack identity (D7) — the panel must say so plainly (Phase 7), because it is
   the design's one visible limitation.

7. **Revocation** — implement the events route: `app_uninstalled` /
   `tokens_revoked` delete the `SlackConnection` for that `slackTeamId` (D3).
   Same code path as `disconnectSlack`; factor it into `lib/slack/actions.ts`.

**Done when:** a church without the add-on sees an upgrade CTA instead of
Connect; with it, connecting shows Slack's channel picker; the row carries a
decryptable token, `channelId`, `channelName` and `ownerSlackUserId`; `authTest`
succeeds; reconnecting rebinds without duplicating; uninstalling from Slack
removes the row.

---

### Phase 3 — Extract the editor-prompt run

**Files:** new `lib/ai/editor-prompt-run.ts`; `lib/ai/page-edit.ts`;
`lib/ai/editor-prompt-service.ts`; `server/trpc/routers/ai.ts`;
`tests/editor-prompt-run.test.ts`.

Much smaller than the first draft's Phase 3, because `runEditorPrompt` already
exists. What is *not* in it is everything Slack also needs: the claim, the
budget, and the job bookkeeping — those live in the tRPC procedure
(`server/trpc/routers/ai.ts:editorPrompt`). Move that body out.

**This is the only phase that touches a path already in production. Review it on
its own merits before any Slack code depends on it.**

```ts
// lib/ai/editor-prompt-run.ts — no Slack types, no Slack imports, no tRPC
export type EditorPromptSource = "web" | "slack";

export interface ExternalRef { channelId: string; actorId: string }

export async function runEditorPromptJob(args: {
  siteId: string;
  userId: string;
  prompt: string;
  path?: string;
  source: EditorPromptSource;
  externalRef?: ExternalRef;
  /** Awaited once the claim and the budget have cleared, before the provider call.
   *  Its return is persisted to the job. A throw is fatal: mark FAILED, spend nothing. */
  onAccepted?: (job: { id: string }) => Promise<{ messageTs?: string } | void>;
}): Promise<EditorPromptOutcome>;

type EditorPromptOutcome =
  | { ok: true; jobId: string; path: string; summary: string; applied: boolean;
      blocks: PageBlocks; improvements: SiteImprovement[] }
  | { ok: false; jobId?: string;
      code: "ALREADY_RUNNING" | "BUDGET_EXHAUSTED" | "COOLDOWN"
          | "NO_SITE" | "NO_PLAN" | "PROVIDER_FAILED" | "POST_FAILED";
      message: string };
```

`externalRef` rather than a Slack-shaped argument keeps `lib/ai/` genuinely
transport-agnostic; `lib/slack/dispatch.ts` owns the mapping onto the
Slack-named job columns.

**Moves in unchanged:** `claimJob` → `assertAiBudget` → `runEditorPrompt` →
`markJobSucceeded` / `markJobFailed`, including the existing "release the slot on
a refused budget" handling.

**Three things added while it moves:**

1. **Ownership and plan re-asserted inside the run.** Load the site with
   `findFirst({ where: { id: siteId, userId } })` — not by id and then compare —
   and check `hasBasePlan(userId)`. Today `paidSiteProcedure` does this, but the
   moment this function gains a non-tRPC caller, moving the gate outside the
   mutating function is exactly how `CLAUDE.md`'s first non-negotiable quietly
   stops being true. It is one query already being made.

2. **The snapshot, written transactionally.** `runEditorPrompt` currently does
   `writePageBlocks` and the `storyConfig` update as two separate statements.
   Restructure: add `pageBlocksWriteOp(siteId, path, blocks)` to
   `lib/ai/page-edit.ts` returning the un-awaited Prisma op, keep
   `writePageBlocks` as a thin wrapper (`lib/chat/service.ts` still calls it),
   and have `runEditorPrompt` run `$transaction([pageOp, storyOp, jobSnapshotOp])`.
   A snapshot must exist **if and only if** a write happened — taking it before
   the provider call leaves a phantom undo point behind every failed prompt.
   Contents: `previousPath = result.path`,
   `previousBlocks = getPageBlocks(siteConfig, result.path)` captured before the
   write, `previousPageExisted = hasStoredPage(siteConfig, result.path)`,
   `previousStory` = the three sidecar keys only (`improvements`,
   `designFeedback`, `mobileFeedback`), `writtenBlocksHash` = sha256 of the
   written tree.

3. **`onAccepted`.** Awaited once the guards have passed and the job row exists,
   before the provider call. This is what lets Slack post a visible "working on
   it" message *only* after budget, cooldown and concurrency have cleared — so
   those failures stay ephemeral and never leave an orphaned message behind.
   Treat a throw as fatal: mark the job `FAILED` and return before spending
   money.

`server/trpc/routers/ai.ts:editorPrompt` becomes: call the run with
`source: "web"`, map `ok: false` onto the `TRPCError` codes it already throws
(`CONFLICT` for `ALREADY_RUNNING`, and so on). **No user-visible change on the
web path.**

**Correction found during implementation:** `ai.editorPrompt` has NO client
caller — the editor UI goes through `chatSend`
(`components/builder/site-chat-panel.tsx`). So this phase refactors a procedure
nothing invokes, and the live edit path is the chatbot, which reaches
`runPageEdit` directly. The real risk here is `page-edit.ts`, not the router.

**Done when:** the editor's assistant panel behaves exactly as before, snapshots
appear on web-path jobs, `lib/ai/` contains no Slack identifiers, and
`npm run verify` is green.

---

### Phase 4 — Authorization for Slack actors

**Files:** `lib/slack/authorize.ts`, `tests/slack-authorize.test.ts`.

```ts
export async function authorizeSlackActor(
  teamId: string, slackUserId: string, channelId: string,
): Promise<
  | { ok: true; siteId: string; userId: string; connection: SlackConnection }
  | { ok: false; code: "NO_CONNECTION" | "NOT_BOUND" | "WRONG_CHANNEL"
         | "NOT_OWNER" | "NO_PLAN" | "NO_ADDON"; message: string }
>;
```

Checks, in this order:

1. A `SlackConnection` exists for `teamId` → else `NO_CONNECTION`.
2. `channelId` and `ownerSlackUserId` are both non-null → else `NOT_BOUND`
   ("reconnect Slack and pick a channel").
3. `channelId === connection.channelId` → else `WRONG_CHANNEL`.
4. `slackUserId === connection.ownerSlackUserId` → else `NOT_OWNER`.
5. `hasBasePlan(connection.installedByUserId)` → else `NO_PLAN`.
6. `hasFeature(userId, ADDONS.slack.featureKey)` → else `NO_ADDON`.

Both billing checks run here, on **every command** — not just at connect time.
`past_due` and `unpaid` revoke entitlements while keeping the subscription live,
so a lapsed church loses Slack access automatically and gets it back the moment
they fix billing, with no reconnect.

Never redirects — a 302 is meaningless to Slack. This is the
`authorizeSiteRequest` pattern (`lib/auth/session.ts`), which returns a status
rather than a redirect, and for the same reason.

Two rules the copy must respect:

- **`WRONG_CHANNEL` names the correct channel only for the bound owner.** To
  anyone else: "Regroup isn't set up for this channel." Naming `#website` to an
  arbitrary workspace member leaks a little for no benefit.
- **`NOT_OWNER` never names the bound account.** "Only the Regroup account that
  connected this workspace can edit the site" — not "ask Sarah."

**Done when:** a table-driven unit test covers all six failure codes plus
success, against mocked Prisma, in the style of `tests/trpc-guards.test.ts`.

---

### Phase 5 — Commands, dispatch, and replies

**Files:** `lib/slack/commands.ts`, `lib/slack/blocks.ts`,
`lib/slack/dispatch.ts`, `trigger/slack-edit.ts`,
`app/api/slack/commands/route.ts`, `tests/slack-command-parse.test.ts`,
`tests/slack-blocks.test.ts`. `lib/slack/api.ts` gains `postMessage`,
`updateMessage`, `postEphemeral`, `respondViaResponseUrl`.

**1. Parse** (`lib/slack/commands.ts` — pure, no I/O, unit-tested):

| Input | Action |
| --- | --- |
| `/regroup`, `/regroup help` | Help block |
| `/regroup status` | Status block |
| `/regroup undo` | Undo the latest edit |
| anything else | Treat as a prompt |

Sub-commands match case-insensitively on the trimmed first token. For prompts:
unescape `&amp;` `&lt;` `&gt;` (Slack escapes these regardless of
`should_escape`), strip any `<@U…>` or `<#C…|name>` markup, collapse whitespace,
and clamp to 600 characters — the ceiling `ai.editorPrompt`'s zod schema already
enforces. Keep the two in sync.

**No page syntax.** `runPageEdit` already retargets to another page when the
model asks, and re-charges the budget for that second call. "Change the header
on the about page" works out of the box, and the reply reports `result.path` so
the church always sees which page changed.

**2. Route shape** (`app/api/slack/commands/route.ts`):

```
isSlackCommandsEnabled → verifySlackRequest → parseCommandBody → parseCommand
  → 200 with an ephemeral JSON body                            ◄── <3s
  → tasks.trigger<typeof slackEditTask>("slack-edit", {...})   (prompt/undo only)
```

Returning the ack **in the 200 body** costs zero round-trips, needs no bot
token, and survives a dead task — the user is never left in silence. `help` and
`status` answer entirely in that body, with no background work and no LLM call.

**3. Dispatch** (`lib/slack/dispatch.ts`) — one function per action, so
behaviour cannot drift between entry points: `handlePrompt`, `handleStatus`,
`handleHelp`, `handleUndo`.

```
handlePrompt:
  authorizeSlackActor(teamId, slackUserId, channelId)
    ok:false → respondViaResponseUrl(ephemeral, message); stop. Nothing posted.
    ok:true  → runEditorPromptJob({
                 siteId, userId, prompt, source: "slack",
                 externalRef: { channelId, actorId: slackUserId },
                 onAccepted: async () => {
                   const r = await postMessage(channelId, workingBlock);
                   if (!r.ok) throw new SlackPostFailed(r.error);   // fatal, pre-spend
                   return { messageTs: r.ts };
                 },
               })
    outcome ok:false → respondViaResponseUrl(ephemeral, failureCopy(code));
                       if a message was posted (PROVIDER_FAILED only), chat.update it
    outcome ok:true  → chat.update(channelId, job.slackMessageTs, resultBlock)
```

Because every guard failure happens before `onAccepted`, nothing visible is ever
posted for a cooldown, a cap hit, or a concurrent edit. Because a failed
`postMessage` throws *inside* `onAccepted`, a bot that has been kicked from a
private channel fails **before** the provider call rather than after.

**4. `trigger/slack-edit.ts`** — `retry: { maxAttempts: 1 }`, for the same
reason `full-build` opts out: the budget already counted the job, and a silent
retry would spend real money the church did not ask to spend. `maxDuration: 120`.
`onFailure` posts the failure line back to the channel. Modelled directly on
`trigger/full-build.ts`.

**5. Blocks** (`lib/slack/blocks.ts`):

- *Working*: "Regroup is updating your site…". Measure a real edit before
  committing to a duration estimate a church will hold you to.
- *Success*: the AI's `summary`; **which page changed** (`result.path` → its
  `SITE_PAGE_LINKS` label); a count of open improvements from
  `result.improvements`; buttons **Open editor** → `/dashboard/builder`,
  **View site** (only when `status === "PUBLISHED"`), **Undo**
  (`action_id: "undo"`, `value: jobId`).
  *Deliberately not `buildEditorNeeds` — it still reads legacy `sections`, so its
  media checks are unreliable on a block-composed site. `improvements` comes
  straight from this edit.*
- *Failure*: one sentence plus the fix. `BUDGET_EXHAUSTED` carries the reset
  date — `RateLimitError` already formats that copy, so pass it through verbatim.
- *Status*: draft/live state, the live URL (an ACTIVE `SiteDomain` if one
  exists, else `https://<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>`), and the remaining
  allowance from `getAiBudget(siteId, "editor_prompt")`.
- *Help*: the four commands, the bound channel, and — explicitly — that undo
  does not refund AI budget, only reaches back one edit, and expires after 15
  minutes.

`tests/slack-blocks.test.ts` asserts block shape and that no site data or bound
account name leaks into a failure block.

**Done when:** prompt, status, help and every failure path answer correctly from
the bound channel, and a command in any other channel is refused ephemerally
without any background work.

---

### Phase 6 — Undo

**Files:** `lib/ai/revert-page-edit.ts`,
`app/api/slack/interactivity/route.ts`, `tests/revert-page-edit.test.ts`.

**1. `revertPageEdit(siteId, userId, jobId?)`:**

- Resolve the target: `jobId` when given, else the newest `editor_prompt` job
  for the site with a non-null `previousBlocks`.
- Refuse, with distinct copy, when:
  - the job is not the newest edit → "this is no longer the most recent change —
    open the editor";
  - `revertedAt` is already set → "already reverted";
  - `finishedAt` is older than 15 minutes (D8) → "too old to undo from Slack";
  - no snapshot exists → "nothing to undo".
- **Do not use `claimJob`.** It creates an `editor_prompt` row, and the monthly
  cap counts those rows — an undo would silently charge the church. Instead
  check `findActiveJob(siteId, "editor_prompt")` and refuse if one is live; the
  transaction below is the real protection against a lost update.
- In one `$transaction`:
  - restore the page through **`repairBlocks`**, not `coerceBlocks` —
    `coerceBlocks` drops a whole top-level node when any descendant fails, which
    on a restore costs the church an entire band over one bad leaf. A stored
    value is still untrusted input;
  - **Home** → `Site.blockConfig`. **Secondary** → `sitePage.upsert`, unless
    `previousPageExisted === false`, in which case `sitePage.delete` so the page
    returns to recomputing its default;
  - merge `previousStory`'s three sidecar keys into the **current**
    `storyConfig` rather than replacing it;
  - set `revertedAt` and `revertedBlocks`.
- **Touch nothing else.** Not `navigationConfig` — the prompt never wrote it and
  navigation auto-saves independently in the editor, so restoring it would roll
  back unrelated work. Not `sectionConfig`, not the six church-story fields
  (`updateChurchInfo` overwrites those wholesale), not any other page.
- If the current tree does not hash to `writtenBlocksHash`, still revert, but
  say so: "Reverted. This also discarded changes saved in the editor since."
- `invalidateSite`.

**2. Interactivity route:**

```
isSlackCommandsEnabled → verifySlackRequest → parse the form-encoded `payload`
  → authorizeSlackActor(team, THE CLICKER's user id, channel)
  → 200 empty (ack within 3s)
  → tasks.trigger the revert + chat.update the original message
```

The clicker is re-authorized independently — a button in a channel is clickable
by anyone who can see it. On success, update the original message to "Reverted"
**with the Undo button removed**.

A double-click needs no `trigger_id` cache: the second click finds `revertedAt`
set and answers "already reverted". Once-only semantics are self-idempotent.

**3.** `/regroup undo` calls the same function with no `jobId`.

Undo does **not** refund AI budget — the provider call happened. Say so in help.

**Done when:** prompt → undo round-trips correctly in the database and on the
published page; a second undo is refused; an undo of a superseded job is
refused; an undo of a first-ever edit to a secondary page removes the `SitePage`
row; `navigationConfig` is provably untouched.

---

### Phase 7 — Settings panel and docs

**Files:** `components/slack/slack-connect-panel.tsx`, `lib/slack/actions.ts`,
`README.md`, `CLAUDE.md`.

1. `SlackConnectionState` gains `channelName`, `commandsEnabled`, `hasAddon`,
   the add-on's display price, and the `editor_prompt` allowance. The panel
   replaces "messaging from Slack is coming soon" with: the bound channel, the
   bound Slack identity, the allowance, and **"reconnecting is how you change
   the channel or the bound account."** That is the design's one real limitation
   and it should be explained, not discovered.
2. `NOTICE_COPY` entries for `no_channel` and `no_addon`.
3. A pre-alpha row (null `channelId`) shows a "Reconnect to finish setup" state.
4. No add-on → the price plus an "Add to plan" link to `/settings/billing`, in
   place of Connect.
5. Hide the command-surface copy entirely when `isSlackCommandsEnabled()` is
   false, the way the Domains screen explains itself when Vercel is
   unconfigured.
6. README §`lib/slack` — replace "Connection only, so far" with the command
   surface, the one-channel/one-identity rule, and the undo semantics.
7. **`CLAUDE.md` correction, unrelated but stale:** it claims `npm run test`
   fails because `tests/` was deleted. `tests/` exists (`setup.ts`,
   `reconcile-run.test.ts`, `trpc-guards.test.ts`) and `npx vitest run` passes
   17 tests in 627ms. `npm run verify` is usable — fix the note.
8. `CLAUDE.md` non-negotiables — add that Slack shares the editor-prompt run,
   and that non-session callers gate **inside** `runEditorPromptJob` rather than
   on `requireOwnedPaidSite` / `paidSiteProcedure`.

**Done when:** a church can buy the add-on, connect, pick a channel, see status,
and disconnect without leaving the product.

---

## 11. Slack app manifest

Create at api.slack.com/apps → From manifest.

```yaml
display_information:
  name: Regroup
  description: Edit your church website by chatting with Regroup's AI.
features:
  bot_user: { display_name: Regroup, always_online: false }
  slash_commands:
    - command: /regroup
      url: https://<host>/api/slack/commands
      description: Edit your church website with AI
      usage_hint: "make the hero warmer | status | undo | help"
      should_escape: false
oauth_config:
  redirect_urls: [https://<host>/api/slack/oauth/callback]
  scopes:
    bot: [commands, chat:write, chat:write.public, incoming-webhook]
settings:
  event_subscriptions:
    request_url: https://<host>/api/slack/events
    bot_events: [app_uninstalled, tokens_revoked]
  interactivity: { is_enabled: true, request_url: https://<host>/api/slack/interactivity }
  org_deploy_enabled: false
  socket_mode_enabled: false
```

Four scopes. Deliberately **not** requested: `channels:join` (`chat:write.public`
covers public channels without it), `users:read.email` (no email matching — a
Slack profile email is not proof of control of a Regroup account, and Auth0
identities may use a different address), `im:history` / `im:write` (no DMs),
`app_mentions:read` (no mentions), `channels:read` (the picker gives us the
channel), `channels:history` (the bot never reads ambient traffic), `files:read`
(no image ingest), `team:read` (`oauth.v2.access` already returns the team name).

That is a short, explicable consent screen — which matters when the person
clicking Allow is a church admin.

**The `incoming-webhook` scope is what renders Slack's channel picker during the
OAuth sequence**, and the exchange response carries `incoming_webhook.channel_id`.
We store that channel id and **ignore the webhook URL entirely** — webhook posts
do not return a `ts`, so they cannot be updated in place, and the design needs
`chat.postMessage` + `chat.update`.

Request URLs are per-environment, so the Slack app is per-environment.

---

## 12. Environment variables

The existing `.env.example` Slack block (lines 102–122) already documents
`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` and
`SLACK_TOKEN_ENCRYPTION_KEY`. Two edits:

```
SLACK_COMMANDS_ENABLED=        # unset/0 = the three command routes 404
```

and update the scope list in that comment to
`commands, chat:write, chat:write.public, incoming-webhook`.

These are provided out-of-band (Slack app creation, secrets, public tunnel URL)
— the same arrangement as Stripe and Auth0. The code must degrade cleanly while
they are unset: `isSlackConfigured()` false → the panel explains Slack isn't
switched on, `isSlackCommandsEnabled()` false → routes 404, `npm run verify`
still passes.

---

## 13. End-to-end flow (happy path)

```
Slack (#website):  /regroup make the hero warmer for young families
  │
  ├─ POST /api/slack/commands             (proxy.ts skipped auth0.middleware)
  │   ├─ isSlackCommandsEnabled
  │   ├─ verifySlackRequest(rawBody)      HMAC + 5-min window, timing-safe
  │   ├─ parseCommand → { kind: "prompt", text }
  │   └─ 200 { response_type: "ephemeral", text: "Working on it…" }   ◄── <3s
  │
  └─ tasks.trigger("slack-edit", …)       durable run
      ├─ authorizeSlackActor(team, user, channel)
      │     connection → bound → channel → owner identity → base plan → add-on
      ├─ runEditorPromptJob({ siteId, userId, prompt, source: "slack", … })
      │   ├─ site loaded by { id, userId }        ownership re-asserted here
      │   ├─ claimJob                             partial unique index = the claim
      │   ├─ assertAiBudget                       shared cooldown with the web editor
      │   ├─ onAccepted → chat.postMessage "Regroup is updating your site…"
      │   │                 └─ ts stored on the job
      │   ├─ runPageEdit                          1 structured call (2 on a retarget)
      │   ├─ applyBlockEdits → repairBlocks       repair, never trust
      │   ├─ $transaction(page write, story write, job + snapshot + hash)
      │   └─ invalidateSite                       Redis + revalidatePath
      └─ chat.update(ts) → summary · page changed · improvements count
                           [Open editor] [View site] [Undo]
```

---

## 14. Security checklist

- [ ] Signature verified over the **raw** body before any parsing; 401 on
      failure; 5-minute window in both directions; `timingSafeEqual` after a
      length check.
- [ ] The three webhook paths return before `auth0.middleware()`; the OAuth
      callback does **not**. Exact match, never prefix.
- [ ] No route trusts `team_id` / `user_id` / `channel_id` from the body for
      *authorization* — they select a row; the row decides what is permitted.
- [ ] Bot tokens encrypted at rest; the plaintext never leaves
      `lib/slack/api.ts`, never logged, never returned to a client.
- [ ] OAuth `state` stays a signed, short-lived, HMAC'd nonce carrying `siteId`.
- [ ] The OAuth callback derives the owner from the **server session**, never a
      query parameter (already true — keep it true).
- [ ] Every prompt re-checks channel, identity, ownership, base plan **and the
      `website_builder` entitlement at execution time**, not just at connect
      time — a lapsed subscriber loses Slack access automatically.
- [ ] The add-on is checked server-side in the OAuth callback too, not only in
      the panel that renders the Connect button.
- [ ] Gating reads `Entitlement` via `hasFeature`, never Stripe or
      `Subscription` (`CLAUDE.md`), and the new `featureKey` is disjoint from
      every existing one.
- [ ] Interactivity re-authorizes the **clicking** user, not the original
      prompter.
- [ ] All model output through `repairBlocks`, including on restore; all URLs
      through `lib/validation/url.ts`. The Slack path adds no new render surface.
- [ ] Prompt text is clamped and reaches the model only through the existing
      LangChain template in `lib/ai/block-prompt.ts` — and remember a literal
      `{` or `}` in a system prompt must be doubled or `invoke()` throws.
- [ ] Error copy never names the bound account or another church's site.
- [ ] Run `/security-review` on the branch before merge.

---

## 15. Failure modes

| Failure | Behaviour |
| --- | --- |
| Command in the wrong channel | Ephemeral refusal in the 200 body; no background work, no LLM call |
| Command from a non-bound Slack user | Ephemeral `NOT_OWNER`; the bound account is never named |
| Connection predates the channel picker | `NOT_BOUND` → "reconnect Slack and pick a channel" |
| Duplicate slash command | The existing partial unique index rejects the second `claimJob` → `ALREADY_RUNNING`, ephemeral |
| Web editor prompt already running | Same — one `editor_prompt` slot per site, by design |
| Slack retries an event | The delete is idempotent; no harm |
| Trigger.dev run dies | `onFailure` marks the job `FAILED` and posts the failure; the slot frees |
| Model returns unusable JSON | Job `FAILED`, site untouched; the posted message updates to "couldn't apply that — try rephrasing" |
| Monthly cap reached | `BUDGET_EXHAUSTED` ephemeral with the reset date; no provider call, nothing posted |
| Cooldown | `COOLDOWN` ephemeral with a human wait time |
| Redis down | Cooldown fails open by design; the Postgres monthly cap still holds |
| Add-on cancelled or billing lapsed | `NO_ADDON` / `NO_PLAN` ephemeral, pointing at `/settings/billing`. Checked per command, so access returns automatically when billing is fixed |
| Bot not in the bound channel | Normally impossible for a **public** channel — `chat:write.public` covers it (D6). For a **private** channel the app was removed from, `postMessage` → `not_in_channel` inside `onAccepted` → fatal **before** the provider call. "Invite @Regroup back to #channel, or reconnect" |
| Bound channel archived or deleted | Same path; the message points at reconnecting to pick a new channel |
| Bot token revoked mid-flight | The post fails; the edit may already have applied — log it, and the next `/regroup` reports the workspace needs reconnecting |
| Model retargets to another page | Second budget charge (already the behaviour); the reply names the page it changed |
| Site changed in the editor since the edit | Undo still wins, but the reply says what it discarded (`writtenBlocksHash` mismatch) |
| Undo clicked on a superseded message | Refused: "no longer the most recent change" |
| Undo clicked twice | `revertedAt` set → "already reverted" |
| Undo clicked outside the 15-minute window | Refused, pointing at the editor |
| Undo of an edit to a never-before-edited page | `previousPageExisted === false` → the `SitePage` row is deleted, page recomputes its default |
| Owner leaves the workspace | Nobody can invoke; the new owner reconnects |
| Church has no site | `NO_CONNECTION` — a connection cannot exist without a site |
| Slack rate limits us (429) | Respect `Retry-After` for the *reply*; never re-run the edit |

---

## 16. Tests and verification

**Unit** (`tests/`, vitest — currently 17 passing, `npm run verify` works)

| File | Covers |
| --- | --- |
| `tests/proxy-raw-body.test.ts` | Webhook paths bypass the middleware; the OAuth callback does not |
| `tests/slack-verify.test.ts` | Valid signature, tampered body, tampered signature, stale/future timestamp, each missing header |
| `tests/slack-crypto.test.ts` | Encrypt/decrypt round-trip; tampered ciphertext throws |
| `tests/slack-command-parse.test.ts` | `help`/`status`/`undo`/prompt routing, entity unescaping, markup stripping, whitespace collapse, length clamping |
| `tests/slack-authorize.test.ts` | Six failure codes + success (mocked Prisma) |
| `tests/slack-blocks.test.ts` | Success/failure block shape; no site data or bound-account name leaks into an error block |
| `tests/editor-prompt-run.test.ts` | Ownership rejection, `ALREADY_RUNNING` via the index, snapshot written only on success, `onAccepted` throw is fatal pre-spend |
| `tests/revert-page-edit.test.ts` | Restore home, restore secondary, delete-when-`previousPageExisted`-false, second-undo refusal, superseded refusal, window expiry, hash-mismatch warning, `navigationConfig` untouched |

**Manual E2E** (requires the Slack app + a public tunnel)

0. No `stripe:bootstrap` run is needed — Slack uses the existing
   `website_builder_monthly` price. Confirm `/settings/billing` shows the
   Website Builder toggle at $29, and that enabling it grants the
   `website_builder` entitlement.

1. `SLACK_COMMANDS_ENABLED` unset → the three command routes 404;
   `/dashboard/slack` is unchanged from today.
2. Without the add-on → `/dashboard/slack` shows the price and "Add to plan",
   not Connect. Hitting `/api/slack/oauth/callback` directly is refused too.
3. Add the add-on, then Connect → **Slack shows a channel picker** → row carries
   `channelId`, `channelName`, `ownerSlackUserId`; token decrypts; `authTest`
   ok; the panel names the channel.
4. Post to a public channel the bot was never invited to → succeeds
   (`chat:write.public`). Remove the add-on mid-life → the next `/regroup` is
   refused with `NO_ADDON`; re-add it → works again with no reconnect.
5. `/regroup help` in the bound channel → ephemeral help, no LLM call, no job
   row.
6. `/regroup help` in another channel → ephemeral refusal.
7. A second workspace member runs `/regroup …` in the bound channel →
   `NOT_OWNER`, and the bound account is not named.
8. `/regroup make the hero warmer` → ephemeral ack, then one channel message
   that updates in place. Check the job row (`source: "slack"`, snapshot, hash),
   the changed `Site.blockConfig`, `/dashboard/builder`, and the published page.
9. `/regroup change the heading on the about page` → the model retargets; the
   reply names `/about`; a `SitePage` row now exists.
10. **Undo** that one → the `SitePage` row is gone, `/about` recomputes its
    default. Click Undo again → "already reverted". `/regroup undo` → "nothing
    to undo".
11. Edit in the web editor, save, then undo an earlier Slack edit → the discard
    warning appears.
12. Fire two prompts within a second → the second is refused, not queued.
13. Start a web editor prompt, then `/regroup …` → `ALREADY_RUNNING`.
14. `/regroup status` → matches `/dashboard`.
15. Exhaust the cooldown (13 prompts in 5 min) → correct wait message, nothing
    posted to the channel.
16. Set `AI_MONTHLY_PROMPT_LIMIT=1`, prompt twice → cap message with reset date.
17. Kick the bot from a **private** bound channel, prompt → invite/reconnect
    message; confirm **no** job row was created and no budget was spent.
18. Uninstall the app from Slack → row deleted; reconnect → works, picker shown
    again, no duplicate row.
19. Tamper with a signature via `curl` → 401, nothing in the database.

**Gate:** `npm run verify` (`typecheck && lint && test`).

---

## 17. Rollout

1. Merge with `SLACK_COMMANDS_ENABLED` unset in production — the connect UI
   keeps behaving exactly as it does today; everything else is dead code paths.
2. `npm run db:deploy`. Purely additive `ALTER TABLE`s, safe ahead of the flag.
   No Stripe work: Slack rides on the existing `website_builder` entitlement,
   so there is no new product, price or `stripe:bootstrap` run.
3. **Confirm the web editor's assistant panel (`chatSend`) still works
   before enabling Slack.** Phase 3 is the only part of this work that can break
   something already in production.
4. `npm run trigger:deploy` for the new task.
5. Create the Slack app in a private workspace; enable the flag on a preview
   deployment first (request URLs must be stable per environment, so the Slack
   app is per-environment).
6. Pilot with one church. Watch: jobs by `source`, `FAILED` rate, undo rate,
   `not_in_channel` rate, cap hits, retarget rate.
7. Kill switch: unset `SLACK_COMMANDS_ENABLED`. In-flight runs finish; new
   requests 404. `lib/slack/api.ts` must read config rather than the flag, so a
   mid-flight reply can still be posted.

---

## 18. Open questions — all resolved

No blockers remain. For the record:

| Was | Resolution |
| --- | --- |
| Does the `incoming-webhook` install seat the bot in the chosen channel? | **Researched, not deferred.** Slack: *"bot users cannot join channels independently and must be invited."* Fixed by requesting `chat:write.public` (D6), which removes the need entirely for public channels. |
| Does `authed_user.id` come back without user scopes? | **Yes** — confirmed in Slack's `oauth.v2.access` reference. Only the nested `access_token`/`scope` need user scopes. One-bound-editor costs no extra scope. |
| Reconnect-to-rebind, or an in-app picker? | Reconnect-to-rebind (D7). `channels:read` + a picker stays on the table if churches reorganize channels often — a scope increase and a screen, no model changes. |
| Gate on base plan or an add-on? | The existing `website_builder` add-on at $29/mo, gating both connect and commands (D9). |
| `/regroup` name collision? | Ship `/regroup`; change the manifest if a pilot workspace collides (D10). |
| Expose undo in the web editor? | Follow-up (D11). Snapshots are written from Phase 3, so it is later UI plus one tRPC mutation, no schema change. |
| Should Slack trigger a full rebuild? | Out of scope. If yes later, it wants a progress message updated per `CREW_STEPS` step — the job row already carries everything needed, and `trigger/full-build.ts` already reports progress. |

**One thing to watch after launch, not before:** the add-on is priced at parity
with Website Builder but shares the same `editor_prompt` monthly cap rather than
raising it. If churches read $29 as "more AI", the change is a per-entitlement
limit in `lib/ai/usage.ts` — currently a flat per-site cap. Deliberately out of
scope; revisit with pilot data.

---

## 19. File manifest

**New**

```
lib/slack/verify.ts              signature + timestamp verification, body parsers
lib/slack/authorize.ts           authorizeSlackActor
lib/slack/commands.ts            pure command parsing
lib/slack/dispatch.ts            handlePrompt / Status / Help / Undo
lib/slack/blocks.ts              Block Kit builders
lib/ai/editor-prompt-run.ts      the shared, transport-agnostic AI-edit run
lib/ai/revert-page-edit.ts       once-only undo
trigger/slack-edit.ts            the durable run behind the 3s ack
app/api/slack/commands/route.ts
app/api/slack/events/route.ts
app/api/slack/interactivity/route.ts
tests/proxy-raw-body.test.ts, tests/slack-*.test.ts,
tests/editor-prompt-run.test.ts, tests/revert-page-edit.test.ts
```

**Changed**

```
prisma/schema.prisma        3 columns on SlackConnection, 8 on SiteGenerationJob;
                            one additive migration, nothing hand-written
proxy.ts                    RAW_BODY_WEBHOOKS early return for the three webhooks
lib/slack/api.ts            isSlackConfigured fix, slackRedirectUri(), authTest,
                            postMessage, updateMessage, postEphemeral,
                            respondViaResponseUrl, extended exchangeOAuthCode
lib/slack/actions.ts        OAUTH_SCOPES, add-on gate, shared revocation path
app/api/slack/oauth/callback/route.ts
                            channel + owner capture, add-on re-check
lib/billing/plan.ts         (no new add-on — Slack rides on website_builder)
scripts/bootstrap-stripe-catalog.ts
                            one SEED_AMOUNTS line
lib/ai/page-edit.ts         pageBlocksWriteOp for transactional writes
lib/ai/editor-prompt-service.ts
                            one $transaction; writes the snapshot
server/trpc/routers/ai.ts   editorPrompt delegates to runEditorPromptJob
components/slack/slack-connect-panel.tsx
                            channel, identity, allowance, add-on CTA
.env.example                SLACK_COMMANDS_ENABLED + scope list
README.md                   replace "Connection only, so far"
CLAUDE.md                   Slack shares the editor-prompt run; fix the stale
                            "npm run test currently fails" note
```
