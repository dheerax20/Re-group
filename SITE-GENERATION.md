# Site Generation — How It Actually Works

A walkthrough of the pipeline as it exists in the code today: what the church
types in, what the AI crew does with it, how a site is saved, published,
served on a subdomain or a custom domain, and where the Redis / budget limits
sit.

Every file path below is real. Where something is *not* built yet, it says so.

---

## 1. The shape of the whole thing

There is **one** Next.js app. It does not generate a codebase or a deployment
per church. Every published church site is the same renderer walking a
different row in Postgres:

```
Site row (Postgres)
  ├── brandConfig      colors, fonts, logo, favicon
  ├── featureConfig    which features are on
  ├── blockConfig      the AI-composed page as a generic block tree  ← what renders
  ├── sectionConfig    legacy SectionInstance[] (still written by some paths)
  ├── navigationConfig nav items
  ├── seoConfig        title + description
  └── storyConfig      city, mission, values + the AI build's log/feedback
        │
        ▼
  BlockTree renderer  →  /sites/<slug>/...  →  <slug>.regroup.app  or  custom domain
```

The AI produces **structured configuration**, never React source. Every style
token the model emits (`padding: "lg"`, `background: "inverted"`) maps to a
literal Tailwind class the renderer picks — the model never writes CSS.

Key files:

| Concern | File |
|---|---|
| Block vocabulary | `lib/site/blocks/types.ts` |
| Block validation / repair | `lib/site/blocks/schema.ts` |
| Renderer | `components/website/blocks/block-renderer.tsx` |
| DB row → render config | `lib/site/to-site-config.ts` |
| Published read path | `lib/site/get-published-site.ts` |

---

## 2. Input fields — what the church actually fills in

The wizard is six steps, defined in `lib/onboarding/steps.ts`, served under
`/builder/<step>?siteId=…`.

### Step 1 — Church Info (`lib/validation/church.ts`)

| Field | Rules | Stored |
|---|---|---|
| `name` | required, 2–120 chars | `Site.name` |
| `denomination` | optional, ≤80 | `Site.denomination` |
| `congregationSize` | optional int, 1–100 000 | `Site.congregationSize` |
| `primaryContactName` | optional, ≤120 | column |
| `primaryContactEmail` | optional, must be an email | column |
| `primaryContactPhone` | optional, ≤30 | column |
| `tagline` | optional, ≤160 | `Site.tagline` |
| `city` | optional, ≤80 | `storyConfig` |
| `worshipStyle` | optional, ≤80 | `storyConfig` |
| `serviceTimes` | optional, ≤160 | `storyConfig` |
| `pastorName` | optional, ≤120 | `storyConfig` |
| `mission` | optional, ≤400 | `storyConfig` |
| `values` | optional, ≤240 | `storyConfig` |

The `storyConfig` fields are the ones that make one church's copy read
differently from another's — they are fed straight into the AI brief.

### Step 2 — Social (`lib/validation/social.ts`)

`facebook`, `instagram`, `youtube`, `x`, `tiktok`. Each optional; if present
must start with `http://` or `https://`. Only non-empty values become
`SocialLink` rows — the write is a delete-all-then-recreate inside one
transaction.

There is also a `podcastRssSchema` for a podcast feed URL.

### Step 3 — Brand (`lib/validation/brand.ts`)

- **Colors** — `primary`, `secondary`, `background`, `foreground`, `accent`.
  All five required, all validated as `#RGB` or `#RRGGBB`.
- **Typography** — `primaryFont`, `secondaryFont`. Constrained to the keys in
  `lib/theme/fonts.ts`. This is not fussiness: the value becomes a CSS custom
  property on a public page, so an arbitrary string there is a style-injection
  vector.
- **Logo** — `url` + `alt`. May be empty (renderer falls back to the church
  name), but publishing requires it.
- **Favicon** — `url`.
- **Tagline** — optional, ≤160.

Defaults if the church skips it: navy `#1E3A5F` / gold `#D4AF37`, Inter +
Playfair Display.

### Step 4 — Features (`lib/features/types.ts`)

Eight booleans, each unlocking sections and pages:

| Flag | Default | What it unlocks |
|---|---|---|
| `sermons` | on | Sermons section + `/sermons` |
| `sermonSearch` | off | Search; **requires** `sermons` |
| `events` | on | Events section + `/events` |
| `youtube` | off | Channel link + media band |
| `podcast` | off | RSS link + episode band |
| `giving` | off | Giving CTA + `/giving` |
| `ministries` | off | Ministries band + `/ministries` |
| `contact` | on | Contact details + `/contact` |

Dependencies are checked by `validateFeatureDependencies` on save, and saving
features also regenerates `navigationConfig`. `navbar / hero / welcome /
about / cta / footer` are always available regardless of flags.

### Step 5 — AI website

Not a form. This is where the crew runs (§3).

### Step 6 — Publish

The slug, plus the publish gate (§5).

### Media uploads (`app/api/uploads/route.ts`)

Logos, favicons, and photos go to Cloudflare R2. The route is session-bound
and ownership-checked (the `siteId` arrives in the form body, so it cannot be
trusted), files are capped at **5 MB**, and the **actual magic bytes** are
inspected rather than the client-supplied `file.type`. SVG is deliberately
rejected — an SVG is a scriptable document served from a public bucket into a
church's page.

---

## 3. How the AI works behind the scenes

### The provider

Everything runs on **OpenAI** via LangChain (`@langchain/openai`).
`lib/ai/agents/model-config.ts` is the single place a model is chosen:

- Default for every role: **`gpt-4o-mini`**.
- Any role can be overridden independently with an env var
  (`AI_MODEL_COMPOSER`, `AI_MODEL_CHAT_ANSWER`, …), so a cost or quality
  change is a deploy, not a code change.
- Per-call timeout: `AI_REQUEST_TIMEOUT_MS`, default **90 s**.
- Retries: `AI_MAX_RETRIES`, default **2** (LangChain's default of 6 turned a
  429 into minutes of silent waiting behind a progress bar).
- No key set → `resolveGateway()` returns null and the build fails fast with
  "No AI provider is configured: set OPENAI_API_KEY."

### The job, not the request

A build is **six sequential LLM calls**, routinely over a minute. It runs as a
**Trigger.dev task**, not inside the request the browser is waiting on.

```
ai.startBuild                    server/trpc/routers/ai.ts
  ├── paidSiteProcedure          ownership + billing, as middleware
  ├── findActiveJob()            already running? return its run id, start nothing
  ├── assertAiBudget()           Redis cooldown + Postgres monthly cap
  ├── createJob()                SiteGenerationJob row, status QUEUED — the ledger
  ├── tasks.trigger("full-build", …, { idempotencyKey: `build-${job.id}` })
  └── attachRunId()              stores triggerRunId on the job row

client subscribes: useRealtimeRun(runId, { accessToken })
```

The task (`trigger/full-build.ts`) calls `runCrewBuild`, reports progress via
`metadata.set()` plus a durable write to the job row, then `commitBuild`
persists the block tree.

Two things this bought over the previous `after()` + polling version:

- **No staleness heuristic.** A QUEUED/RUNNING row used to be swept as dead
  after 5 minutes (`STALE_JOB_MS`), because `after()` gave no way to tell a
  slow build from a killed one. A Trigger.dev run has an observable status and
  an `onFailure` hook that marks the row terminal, so that guess is gone.
- **No poll loop.** Progress arrives when it happens instead of up to 2.5s
  late. `ai.buildStatus` still exists, demoted to a *resume* path: a client
  that reloads mid-build calls it once to recover the run id and a fresh
  scoped token, then re-subscribes.

The task deliberately sets `retry: { maxAttempts: 1 }`. Each attempt is six
LLM calls and the budget already counted the job — a silent retry would spend
money the church did not ask to spend.

The progress the church sees is real: each specialist writes `step` and
`stepIndex` as it finishes. It is not a timer.

### Art direction is chosen in code, not by the model

`lib/ai/agents/catalog.ts` defines a set of named `ArtDirection`s (Cinematic,
Modern Minimal, Warm Editorial, …). Each locks navbar / hero / welcome /
about / sermons / events treatment, plus a `mood` and a `copyVoice`.

`pickArtDirection()` is passed the site's **previous** `styleName` and
deliberately avoids repeating it. This is the fix for "regenerating produces
the same site": models told to "prefer cinematic" reliably prefer cinematic
every single time, so structural variety is now a code decision made once per
build, and every agent is briefed on the same fixed direction.

What the model still fully controls: which optional bands appear and in what
order, the entire layout inside them, and every word of copy.

### The crew (`lib/ai/agents/crew.ts`)

`CREW_STEPS` — the six steps the progress UI reads:

| # | Step id | Role | Does |
|---|---|---|---|
| 1 | `producer` | Executive producer | Church archetype + design goal, grounded in the real profile |
| 2 | `theme-director` | Art director | Same call as ①, `creativeBriefSchema` covers both |
| 3 | `layout-architect` | Page composer | **Writes the homepage directly as a block tree** — layout and copy together |
| 4 | `copywriter` | SEO | Page title + description |
| 5 | `media-director` | Media planner | The photo checklist to hand the church |
| 6 | `responsive-qa` | Design + mobile QA | Advisory notes, surfaced not auto-applied |

Two deliberate optimisations:

- **Producer + art director are one call.** The second agent's only input was
  the first's output — a full round trip for a handoff the model does
  internally anyway.
- **The media director runs concurrently.** It only ever needed the church
  profile, the direction, and a rough list of planned bands — all knowable
  before the composer runs (`plannedBandTypes()`). It used to sit on the
  critical path waiting for a composed tree it did not read. Its promise gets
  a no-op `.catch()` immediately so a rejection in the meantime is not an
  unhandled rejection that kills the process.

Progress reporting is wrapped in try/catch — a failed progress write must
never fail an otherwise-good build.

### Structured output

`structuredChain()` in `lib/ai/agents/specialists.ts` handles two awkward
realities of OpenAI's structured-output mode:

1. **zod v4 emits `oneOf` for a discriminated union; OpenAI rejects it**
   (`400 … 'oneOf' is not permitted`). This killed *every* build at the page
   composer, the one agent whose schema contains a union (the recursive block
   tree). `toOpenAiJsonSchema()` rewrites `oneOf` → `anyOf` across the whole
   document including `$defs`, and drops `$schema`.
2. **`strict: true` requires every property to be in `required`.** Fine for
   the flat agent schemas; impossible for the block tree, which has many
   genuinely optional fields. Those chains opt out of strict mode, hand
   OpenAI the sanitized JSON Schema, and re-parse the response with the
   original zod schema themselves.

Temperatures are grouped by task: schema-bearing agents run ~0.55 so
structured output parses reliably; the prose-only roles run ~0.8 so two
churches given the same locked direction don't read like the same paragraph
with the name swapped.

### Writing the result

Model output is never trusted on the way in. `coerceBlocks()` re-validates the
composed tree at the write site — capped recursion depth (**6**), capped
children per node (24 for section/stack, 8 for row), every URL run through
`safeMediaUrl` / `safeLinkTarget`.

The write is one transaction:

- `blockConfig` ← the validated block tree
- `sectionConfig` ← **only** if the crew produced no blocks
- `navigationConfig`, `seoConfig`
- `storyConfig` ← merged with `improvements`, `designFeedback`,
  `mobileFeedback`, `agentLog`, `styleName`
- the job row → `SUCCEEDED`, with the log and a summary

`blockConfig` is a separate column from `sectionConfig` on purpose. Several
writers still read and write `sectionConfig` in the legacy shape (the AI chat
editor, `enableFeatureOnSite`); overloading one column with two incompatible
shapes let any of them silently destroy a composed page.

Then `invalidateSite()` clears the caches.

On failure the job is marked FAILED with a message trimmed to 280 chars, and
an "Invalid schema" error is rewritten to "The AI returned an unusable layout.
Try again."

### The other two AI surfaces

- **One-shot editor prompt** (`lib/ai/editor-prompt.ts`) — a single call that
  rewrites section copy, kind `editor_prompt`.
- **Site chatbot** (`lib/ai/chat/graph.ts`) — a small LangGraph. A classifier
  node decides "question or edit", and a conditional edge routes to
  `answerQuestion` or `applyChange`. `applyChange` calls **the same**
  `applyEditorAiPrompt` the editor box uses, so the chatbot is not a second,
  less-validated way to touch a site. History fed to the model is capped at
  **8 turns**. One conversation per site (`ChatMessage`), and
  `appliedSummary` is set only on replies that actually changed the site —
  that is both the "Applied" badge and the audit trail.

---

## 4. Live editing and save

`components/builder/builder-workspace.tsx` is the editor. It is deliberately
narrow right now, and the file says so:

- A **true-to-final preview** — it renders the real block tree with the same
  `BlockTree` component the public page uses, so what the church sees is what
  ships. Desktop/mobile toggle.
- The **navigation editor**.
- The **AI assistant** panel.

**Block-by-block direct editing is not built yet.** Until it is, structural
changes come from rebuilding with the crew or asking the assistant. The
~650-line section-by-section visual editor that used to be here was removed
because it edited `sectionConfig` — a column the renderer had stopped reading.

### Saving

There is no autosave and no draft/published split of the content itself.
Every mutation is a **tRPC procedure** that writes straight to the `Site` row
and then invalidates:

| Action | Writes |
|---|---|
| `updateChurchInfo` | columns + `storyConfig` |
| `updateSocialLinks` | `SocialLink` rows (transactional replace) |
| `updateBrand` | `brandConfig` |
| `updateFeatures` | `featureConfig` + regenerated `navigationConfig` |
| `updateSections` | `sectionConfig` |
| `updateNavigation` | `navigationConfig` |

All of them are built on `paidSiteProcedure`, which checks ownership **and**
billing as middleware. That replaced the copy-pasted `requireOwnedPaidSite`
first line of every action: a site mutation can no longer be written that
silently skips the check, because it would not typecheck against the builder.

Server Components go through the same procedures via a server-side caller
(`server/trpc/caller.ts`) rather than importing the services directly — so a
page and a browser mutation are gated identically.

`updateNavigation` additionally rejects any href not in
`allowedHrefs(features)`, so navigation cannot point at a page the church's
features don't enable.

### Invalidation (`lib/site/invalidate.ts`)

One function, called by every writer. It:

1. `revalidatePath()` for every public path, derived from `SITE_PAGE_LINKS` —
   so adding a new public page is covered automatically.
2. Revalidates the dynamic `sermons/[slug]` and `events/[slug]` segments.
3. `invalidateSiteCache(slug)` — deletes the three Redis keys.
4. Revalidates the authenticated app paths, unless `publicOnly` is set.

This used to be two overlapping lists in two files, and a miss showed up as a
church editing their site and seeing no change.

---

## 5. Publishing

`publishSite(siteId, slug)` in `lib/site/actions.ts`.

**Validation happens before any mutation.** The earlier order renamed the site,
then bailed on a validation error — leaving a changed slug on a site that never
published, with the old slug's caches never cleared.

`validateSiteForPublish` (`lib/site/publish-validation.ts`) requires:

- a non-empty church name
- a valid slug
- **a logo** (`brand.logo.url`)
- primary + secondary colors, and a primary font
- `templateId === AI_GENERATED_TEMPLATE_ID` — every site is crew-composed now;
  anything else is a stale record and is told to rebuild first
- feature dependencies satisfied
- non-empty navigation
- no unknown section types

Then: slug uniqueness is re-checked, the row flips to `PUBLISHED` with
`publishedAt`, **both** the old and new slug's caches are invalidated on a
rename, `syncPrimaryDomain()` runs, and `/dashboard/domains` is revalidated.

`unpublishSite()` flips back to `DRAFT` and invalidates. Unpublishing makes
custom domains stop resolving too — the hostname lookup requires
`site: { status: "PUBLISHED" }`.

---

## 6. Subdomains and routing

`proxy.ts` at the repo root (Next.js proxy/middleware) does the rewrite.

Order of operations, and each step is load-bearing:

1. **`/api/stripe/webhook` returns immediately**, before Auth0 middleware. The
   webhook is verified by signature over the raw body, has no session to
   refresh and no cookies to set — nothing session-related should go anywhere
   near it.
2. `auth0.middleware(request)` runs; `/auth/*` returns straight from it.
3. Platform paths (`/sites`, `/api`, `/_next`, `/favicon.ico`) pass through.
4. Platform hosts (`regroup.app`, `www.regroup.app`, `localhost`, `127.0.0.1`)
   pass through — that's the marketing site and the app.
5. `<slug>.regroup.app` → slug extracted by suffix. `www` is excluded.
   Locally, `<slug>.localhost:3000` works the same way.
6. Anything else containing a dot can only be a custom domain → resolved (§8).
7. On a hit: rewrite to `/sites/<slug><pathname>`, **copying the Auth0 cookies
   onto the rewrite response** so the session survives.
8. On a miss: fall through to normal routing → the platform 404.

Root domain is `NEXT_PUBLIC_ROOT_DOMAIN`, default `regroup.app`.

---

## 7. Events (and sermons)

Events are ordinary rows, not part of the block tree. `Event` in
`prisma/schema.prisma`: `title`, `slug`, `description`, `startAt`, `endAt`,
`location`, `imageUrl`, `registrationUrl`, with `@@unique([siteId, slug])` and
an index on `[siteId, startAt]`. `onDelete: Cascade` from `Site`.

### Creating one attaches it to the site automatically

`createEvent()` in `lib/site/content-actions.ts` runs in one transaction:

1. Validate (`title` 2–160, `startAt` required, `registrationUrl` must be
   HTTPS).
2. Generate a unique slug from the title — collisions get `-2`, `-3`, …
3. Insert the row.
4. **`enableFeatureOnSite(siteId, "events", { variant: "grid" })`** — turns on
   the `events` feature flag, enables or inserts the matching homepage
   section, and regenerates navigation.

That last step is the "attachment": a church that adds their first event does
not then have to go find a toggle to make it appear.

Then `invalidateSite()`.

### How they reach the page

Two different read paths, on purpose:

- **`getSiteContent()`** (inside the cached published-site payload) — the
  *homepage* slice. Events from the last 24 h forward, `take: 20`, ascending;
  sermons newest-first, `take: 20`. Wrapped in a DB-unavailability check that
  returns empty content rather than throwing onto a live church's homepage.
- **`getCachedEvents(siteId, slug)`** — the full list for `/events` and
  `/events/[slug]`, its own Redis key, **1 hour** TTL. An empty list is a real
  value and never takes the negative-cache path.

`/events` 404s if `features.events` is off. The block tree reaches the same
data through the data-bound `eventCollection` block (`layout: grid | list |
calendar`, `limit`) — the AI controls presentation only, never the content.

Sermons work identically (`sermonCollection`, `createSermon`,
`getCachedSermons`).

---

## 8. Custom domains

Vercel-backed. Gated on `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID`; without them
the Domains screen explains the feature is off rather than failing at runtime.

### The invariant

A hostname routes to **at most one** site, and only to a site whose owner
proved control of it. `SiteDomain.hostname` is `@unique` globally — enforced by
the database, not by remembering to check. That uniqueness is what makes the
resolver cache safe.

### Adding one (`lib/domains/actions.ts`)

1. `requireOwnedPaidSite`, then a rate limit of **10 domain attempts per hour
   per user**.
2. `validateHostname()` (`lib/domains/hostname.ts`) — strips scheme, path,
   port, trailing dot and case; rejects empty, >253 chars, wildcards,
   no-dot, IP addresses, `.local` / `.localhost`, and the platform's own
   domain.
3. Cap of **5 domains per site**.
4. **The apex and its `www.` are always attached as a pair.** This used to be
   a checkbox, which asked a church to decide something they have no basis to
   decide and no reason to decline — and unticking it meant visitors who typed
   `www.` got an error. Deeper subdomains (`give.gracechurch.org`) stand alone;
   there's no conventional partner for them.
5. Conflicts are reported distinctly: already yours vs. already another
   church's.
6. **Vercel is called before any row is written**, so the database never claims
   a hostname the platform cannot serve. The hostname the church actually typed
   must succeed; its `www.` partner is best-effort and only logs a warning.
7. Row written as `PENDING_DNS` or `PENDING_VERIFICATION` (the latter when
   Vercel returns a TXT challenge because another Vercel account claims it),
   then `refreshDomainStatus()` reads the real state immediately so the UI
   opens on facts rather than the optimistic row.

### DNS records the church is told to add

`dnsRecordsFor(hostname)`:

- **Apex** → `A @ → 76.76.21.21` (a CNAME at the zone apex is invalid DNS).
- **Subdomain** → `CNAME <label> → cname.vercel-dns.com` (so the target can
  change later without the church touching anything).

Both overridable via `VERCEL_APEX_IP` / `VERCEL_CNAME_TARGET` for Enterprise
projects with dedicated records. `MULTI_PART_SUFFIXES` handles `co.uk`,
`com.au`, `co.in`, etc. so `church.co.uk` is recognised as an apex — it's not
a full public suffix list, and being wrong only means suggesting a CNAME where
an A record would also have worked.

### Serving (`lib/domains/resolve.ts` + `lib/domains/proxy-resolve.ts`)

```
Host header
   │
   ├─ Redis  host:<hostname>       (6 h TTL, 60 s negative TTL)
   │     hit → slug (or null)
   │
   └─ miss → GET /api/internal/hostname?host=…   (x-internal-secret)
                 └─ Postgres: SiteDomain where status=ACTIVE
                              AND site.status=PUBLISHED
                    → cache the answer, positive or negative
```

Things to know:

- **Only `ACTIVE` domains resolve.** A `PENDING` domain whose DNS already
  points here must not serve — until Vercel has verified it, the hostname may
  still belong to somebody else.
- **The proxy cannot use Prisma.** Next.js may run it outside the app runtime,
  so `proxy-resolve.ts` talks to Upstash over plain `fetch` with no client
  library and falls back to an internal route handler that owns the query.
  That route is authenticated by `INTERNAL_API_SECRET`; **custom domains will
  not resolve without it.**
- It reads both cache shapes — the app layer writes `{"slug":"grace"}` via
  `@upstash/redis`, the proxy writes bare strings.
- Everything fails soft. If neither Redis nor the resolver answers, the request
  falls through to normal routing and the visitor gets the platform 404, not a
  proxy error.

The 6-hour TTL is long on purpose: every write that could change what a
hostname serves calls `invalidateSiteHostnames()`, so the cache is corrected
explicitly. The TTL only bounds staleness for changes made *outside* the app
(someone deleting the domain in the Vercel dashboard). A short TTL meant
serving depended on the resolver route being reachable every few minutes — and
when it wasn't, a fully configured church domain silently fell through to the
platform site.

---

## 9. Redis, caching, and limits

Upstash Redis over REST (`@upstash/redis` — fetch-based, so there's no
persistent TCP connection to exhaust across serverless invocations).

**Redis is never a hard dependency.** Unconfigured, down, or returning garbage,
every path degrades to hitting Postgres directly and logs it.

### Cache keys and TTLs

| Key | TTL | Written by |
|---|---|---|
| `site:<slug>:published` | 1 h | `getPublishedSiteBySlug` |
| `site:<slug>:sermons` | 1 h | `getCachedSermons` |
| `site:<slug>:events` | 1 h | `getCachedEvents` |
| `host:<hostname>` | 6 h (60 s negative) | hostname resolver |
| `rl:<key>:<window>` | window length | rate limiter |

Page-level ISR sits on top: `/sites/[siteSlug]` sets `revalidate = 300`.
`getPublishedSiteBySlug` is also wrapped in React `cache()`, which dedupes
across `generateMetadata` + layout + page within a single render pass.

### Negative caching

A `null` in the cache is indistinguishable from a miss, so a sentinel
(`__regroup_absent__`) is stored for "the source returned nothing, and that is
the answer." Without it, every request for an unpublished or nonexistent slug
reached Postgres — an unauthenticated path with no ceiling on it. Storing the
miss makes slug and hostname enumeration cost Redis instead. The negative TTL
is short (60 s) so a newly published site doesn't have to wait out the full
positive TTL.

### Rate limits (`lib/rate-limit.ts`)

Fixed-window counter: `INCR`, and `EXPIRE` only on the request that created
the bucket (setting it every time would slide the window forward and never let
it reset).

**Fail-open by design.** Redis down → the request is allowed and logged. That
is the right trade for an abuse throttle: a cache outage must not lock every
church out of their own editor. A fixed window admits up to 2× the limit across
a boundary, which is immaterial for cooldowns — but it is *not* sufficient on
its own for anything that costs money per call, which is why the AI budget has
a second layer.

Concrete limits:

| Limit | Value | Where |
|---|---|---|
| Domain add attempts | 10 / hour / user | `domain:add:<userId>` |
| Domains per site | 5 | Postgres count |
| Upload size | 5 MB | upload route |

### The AI budget — two layers (`lib/ai/usage.ts`)

**Layer 1 — Redis cooldown.** Stops the accidental storm (a refresh loop, a
double-clicked Regenerate). Fails open.

| Kind | Cooldown |
|---|---|
| `full_build` | 3 per 10 minutes |
| `editor_prompt` | 12 per 5 minutes |
| `chat_message` | 20 per 5 minutes |

**Layer 2 — Postgres row count.** The monthly budget. **Cannot be reset by
flushing a cache**, which is what makes it safe to expose a button that spends
money on every press.

| Kind | Monthly cap | Env override | Counted from |
|---|---|---|---|
| `full_build` | 25 | `AI_MONTHLY_BUILD_LIMIT` | `SiteGenerationJob` rows |
| `editor_prompt` | 150 | `AI_MONTHLY_PROMPT_LIMIT` | `SiteGenerationJob` rows |
| `chat_message` | 300 | `AI_MONTHLY_CHAT_LIMIT` | `ChatMessage` rows, `role: USER` |

Counting rows rather than keeping a separate counter means the ledger and the
audit trail are the same record. **A failed job still counts** — the provider
was still called. Chat is metered on USER messages because "one message" is
the unit a church reasons about, regardless of whether the reply underneath
was one small classify call or classify + a full generation call.

The window resets at the 1st of the month (UTC), and the error copy names the
date. `assertAiBudget()` is always called **before** the provider request —
the whole point is to not make the call.

---

## 10. Environment variables that change behaviour

| Var | Effect if unset |
|---|---|
| `OPENAI_API_KEY` | All AI is off; builds fail with a clear message |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | No caching, no rate limiting (fails open) |
| `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` | Custom domains screen says the feature is off |
| `INTERNAL_API_SECRET` | **Custom domains do not resolve on a cache miss** |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Defaults to `regroup.app` |
| `R2_*` | Media uploads unavailable |
| `TRIGGER_SECRET_KEY` | **AI builds cannot start** — the crew has nowhere to run |
| `SLACK_*` | Slack screen explains it isn't switched on |
| `GHL_TOKEN` + `GHL_COMPANY_ID` | GoHighLevel provisioning skipped entirely |

---

## 11. What is not built yet

- **Direct block-by-block visual editing.** The preview is read-only;
  structural change means a rebuild or the AI assistant.
- **Multi-site per account.** `Site.userId` is `@unique` — one website per
  Auth0 account.
- **Per-page AI composition.** The crew composes the homepage; `/about`,
  `/contact`, `/giving`, `/ministries` are fixed templates reading the same
  config.
- **Tests.** The `tests/` directory was removed in the current working tree.
- **Block-level tRPC.** `site.updateSections` still writes the legacy
  `sectionConfig` shape; there is no procedure that edits `blockConfig`
  directly, because there is no UI that does either.
