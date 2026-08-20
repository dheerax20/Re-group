# Regroup — Church Website Builder

A multi-tenant church website builder. One Next.js application serves every
church — each site is a row in Postgres rendered through a shared
Template + Theme + Feature engine, not a separate deployment.

Auth0 handles authentication, Stripe handles subscriptions, and every screen
under `app/(app)/(paid)` plus every mutating Server Function requires a live
base plan.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL · Prisma ·
Zod · React Hook Form · Auth0 · Stripe · Upstash Redis · Cloudflare R2 ·
LangChain (`langchain` + `@langchain/openai`) for the AI site-building crew.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill it in. Every variable is documented
   there. The minimum for a working local app is `DATABASE_URL`, the four
   `AUTH0_*` values, and `STRIPE_SECRET_KEY`.

   Optional, each degrading cleanly when unset:

   | Unset | Effect |
   | --- | --- |
   | `OPENAI_API_KEY` | Template recommendations fall back to the rule-based engine; the AI crew reports that it is unavailable |
   | `UPSTASH_REDIS_*` | No caching or rate limiting; reads go straight to Postgres |
   | `R2_*` | Uploads fail; everything else works |
   | `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` | The Domains screen explains that custom domains are switched off |
   | `INTERNAL_API_SECRET` | Custom domains do not resolve (`proxy.ts` cannot reach the resolver) |

3. **Set up the database**

   ```bash
   npm run db:deploy   # apply prisma/migrations
   npm run db:seed     # seed the templates
   ```

   On a database that predates the migration baseline, see
   `prisma/migrations/README.md` first.

   `SEED_DEMO_CHURCH=1 npm run db:seed` also creates a fully published demo
   church, which is useful when working on the public renderer.

4. **Set up Stripe**

   ```bash
   npm run stripe:bootstrap                                   # create the catalog
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Put the `whsec_…` the CLI prints into `STRIPE_WEBHOOK_SECRET`. It differs
   from the one in the dashboard.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   - App: http://localhost:3000
   - A published site: http://grace-community.localhost:3000
     (most browsers resolve `*.localhost` to loopback automatically, which
     exercises the same host-based tenant routing used in production)

## How multi-tenancy works

`proxy.ts` reads the request hostname and resolves it to a site slug two ways:

- **Platform subdomains** — `<slug>.regroup.app` (or `<slug>.localhost` in dev)
  are parsed directly from the host. No lookup.
- **Custom domains** — anything else is resolved against `SiteDomain`, and only
  `ACTIVE` rows resolve. The proxy cannot open a database connection, so it
  reads Upstash over `fetch` and, on a cache miss, calls
  `/api/internal/hostname` (guarded by `INTERNAL_API_SECRET`), which owns the
  Prisma query and repopulates the cache. Negative results are cached too, so
  pointing arbitrary DNS at the platform cannot generate database load.

Either way the request is rewritten to `/sites/<slug>/...`. Every public page
lives under `app/sites/[siteSlug]/` and the renderer never knows how the tenant
was resolved.

### Custom domains

Churches connect their own domain at **/dashboard/domains**. The flow:

1. The hostname is validated (`lib/domains/hostname.ts`) and attached to the
   Vercel project (`lib/domains/vercel.ts`). Vercel is called *first*, so the
   database never claims a hostname the platform cannot serve.
2. The apex and its `www.` are always connected together — `pairedHostnames()`
   — in whichever order they were typed. This is not optional: a church has no
   basis to decline it, and one that did would have visitors typing `www.` land
   on an error.
3. The UI shows the exact records to add — an `A` record for the apex, a `CNAME`
   for `www.` — plus a `TXT` challenge if the domain is claimed by another
   Vercel account.
4. Status is always re-read from Vercel, never inferred. A domain goes `ACTIVE`
   only when it is both verified *and* correctly configured; serving it earlier
   would show visitors an error page under the church's own name.

**One domain is one card.** The database stores each hostname as its own
`SiteDomain` row, because Vercel and the resolver both work per-hostname, but
`groupDomains()` collapses them by registrable domain for display. A group is
live only when every hostname in it is, and verify/remove/set-primary all act on
the whole group — keyed by the registrable domain, not a row id.

Requires a Vercel API token with access to the project (and the team, if the
project belongs to one).

## Where things live

- `lib/site` — `SiteConfig`, Zod validation, navigation generation, publish
  validation, and the Server Functions behind the onboarding/builder flow.
  `to-site-config.ts` is the single boundary where `Json` columns become typed
  values, and it coerces rather than casts.
- `lib/domains` — hostname rules and DNS guidance, the Vercel client, the
  resolver (app and proxy variants), and the domain Server Functions.
- `lib/billing` — Stripe catalog, sync, entitlements, and the paywall. `sync.ts`
  is the only writer to the billing tables.
- `lib/auth/session.ts` — `requireOwnedPaidSite` is the gate for every
  mutation. Layout paywalls do not cover Server Functions.
- `lib/ai` — the recommendation engines, the multi-agent crew, the persisted
  generation job, and the monthly AI budget. AI only ever returns JSON.
  - `lib/ai/agents/catalog.ts` holds the six `ArtDirection` archetypes the
    crew builds from — real combinations of the section variants that
    actually have components, not a free-text style the model invents.
    `pickArtDirection()` chooses one per build and avoids repeating whatever
    the site's previous build used, which is what makes "Regenerate"
    produce a structurally different site instead of the same layout with
    different words.
  - `lib/ai/agents/model-config.ts` decides which OpenAI model answers each
    agent — the crew's six, plus `editor` (the in-editor prompt) and
    `chatClassifier`/`chatAnswer` (the site chatbot below). Nothing here
    changes behavior until you opt in via env vars (documented in
    `.env.example`) — every role defaults to `gpt-4o-mini`.
    `AI_MODEL_<ROLE>` overrides one role's model independently of the rest,
    e.g. a stronger model for just the copywriter.
  - `lib/ai/chat` — the site chatbot, and the first real
    [LangGraph](https://langchain-ai.github.io/langgraphjs/) in the
    codebase rather than a hand-written chain. A message is classified as
    an edit request or a question (`classify`), then routed to either
    `applyChange` — which calls the exact same `runPageEdit`
    function the in-editor "AI prompt" box always used, so the chatbot is
    not a second, less-validated way to touch a site — or `answerQuestion`,
    which is read-only and cannot mutate anything. `lib/chat/actions.ts` is
    the server boundary: one growing `ChatMessage` thread per site, gated
    by the same budget pattern as the AI build (`lib/ai/usage.ts`'s
    `chat_message` kind — a flat monthly quota per site,
    `AI_MONTHLY_CHAT_LIMIT`, counted in Postgres so it can't be reset by
    clearing a cache).
- `lib/slack` — connects a church's Slack workspace to their site
  (`/dashboard/slack`). **Connection only, so far** — a workspace and a site
  can be introduced to each other; sending a message from Slack into the
  chatbot above is a separate, not-yet-built piece, and the UI says so
  rather than implying otherwise.
  - The OAuth flow is stateless: `lib/slack/state.ts` signs a short-lived,
    HMAC'd `state` param carrying the `siteId` through the redirect, which
    is both the CSRF protection Slack's flow expects and how
    `app/api/slack/oauth/callback/route.ts` knows which site an install is
    for. No server-side row to store or expire.
  - `SlackConnection.botAccessToken` is encrypted before it touches
    Postgres (`lib/slack/crypto.ts`, AES-256-GCM) — the first third-party
    bearer credential this app keeps in its own database rather than only
    in env vars, since it's a live ability to post into a church's Slack.
  - One workspace per site and one site per workspace, both directions
    unique — matching `Site.userId`'s shape elsewhere in the schema.
- `lib/validation/url.ts` — the rules for anything reaching an `href` or `src`
  on a published site.
- `lib/features`, `lib/theme`, `lib/templates` — feature dependency rules, the
  approved font registry and CSS-variable generation, and the stock templates.
- `components/website/sections` — the section components, each with 2–3
  variants; `components/website/renderer` — the fixed `sectionRegistry`.
  Components resolve only through that registry, never from user input.
- `app/(platform)/builder` — the onboarding wizard.
- `app/(app)` — the authenticated product. `(paid)` inside it is the paywall;
  `settings/billing` sits deliberately outside it.
- `app/sites/[siteSlug]` — the public, published website.

## Design tokens

`app/globals.css` holds two token families and they must not be mixed:

- **App tokens** (`--surface`, `--brand`, `--success`, `--editor-*`) style
  Regroup's own chrome, consumed as `bg-surface`, `text-muted`, and so on.
- **Site tokens** (`--color-primary`, `--font-primary`) are the *church's*
  brand, injected per request by `ThemeProvider`, and read only through the
  `site-` prefixed utilities (`bg-site-primary`).

Styling product chrome with a `site-` utility leaks a church's colours into the
dashboard. The app follows the OS colour scheme; published church sites do not,
because a church picks explicit brand colours.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run verify` | Typecheck, lint, and test — what CI runs |
| `npm run test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Apply migrations (use this on any shared database) |
| `npm run db:migrate` | Create and apply a dev migration |
| `npm run db:push` | Push the schema with no migration history — local throwaway only |
| `npm run db:seed` | Seed templates (`SEED_DEMO_CHURCH=1` adds the demo church) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run stripe:bootstrap` | Create the Stripe product catalog and portal config |
| `npm run billing:backfill` | Backfill `SubscriptionItem.planKey` on old rows |
| `npm run billing:prune` | Prune processed Stripe event records |

## Not built yet

Members and Courses are stubs — the screens say so rather than showing sample
data. YouTube and podcast sync workers, analytics, and AI-generated React code
are also out of scope. The `StorageProvider`, `MediaProvider`, and
`SiteGenerationProvider` interfaces are shaped so none of that requires
rewriting the website engine.
