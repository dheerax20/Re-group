@AGENTS.md

# Regroup — working rules

Multi-tenant church website builder. One Next.js 16 app serves every church: a
site is a `Site` row whose `Json` columns render through a shared block engine.
No per-church deployment, no per-church code. Clerk for identity, Stripe for
plans, OpenAI/LangChain for generation.

`README.md` is the orientation doc and is current — read it before changing an
area you don't know. (`website_builder_ai.md` and `template_working.md` predate
the block rewrite and describe the deleted section/template layer; don't trust
them.)

## The two content models

The most confusing thing in the codebase, so know it before touching a site:

- **`Site.blockConfig`** — the AI-composed page tree
  (`lib/site/blocks/types.ts`). This is what a **published page renders**.
- **`Site.sectionConfig`** — the older `SectionInstance[]`. Still what the
  builder UI edits and what the AI *edit* paths (`lib/ai/editor-prompt.ts`, the
  chatbot) read and write.

`toSiteConfig` bridges them: `toPageBlocks(site.blockConfig ?? site.sectionConfig)`
synthesizes blocks from legacy sections so older sites still render. Expect both
to be live; don't "clean up" one without following every call site.

## Non-negotiables

- **Mutations gate on `requireOwnedPaidSite`** (`lib/auth/session.ts`). Server
  Functions are POSTs to the page that defines them, so `(paid)/layout.tsx`
  never runs for them — the layout paywall does not cover them. Read-only
  actions may use `requireOwnedSite`; Route Handlers use
  `authorizeSiteRequest`, which returns a status instead of a redirect.
- **Blocks resolve through the one switch in
  `components/website/blocks/block-renderer.tsx`.** A block's `type` selects a
  fixed case — never a dynamic import from a database value or user input.
- **Style tokens become literal Tailwind classes, only in
  `components/website/blocks/tokens.ts`.** Never interpolate (`` `py-${x}` ``):
  Tailwind's scanner must see every class at build time. The model picks
  tokens; the renderer owns the classes and every breakpoint.
- **Model output is repaired, never trusted.** Block output goes through
  `coerceBlocks` / `repairBlocks` (`lib/site/blocks/schema.ts`), section output
  through `coerceSections` (`lib/validation/section.ts`) — at the write site,
  every time. AI returns structured JSON only, never React or Next source.
- **URLs reaching `href`/`src` go through `lib/validation/url.ts`.** Write paths
  use the schemas (`linkTargetSchema`, `mediaUrlSchema`); render paths use
  `safeLinkTarget` / `safeMediaUrl`.
- **`lib/site/to-site-config.ts` is the only place `Json` columns become typed
  values.** It coerces rather than casts — one bad field must degrade to a
  default, not throw on a published church's homepage.
- **`invalidateSite` (`lib/site/invalidate.ts`) is the one place a site's
  caches are cleared.** Add public pages to `SITE_PAGE_LINKS` and invalidation
  follows. (A feature screen may still `revalidatePath` its own route.)
- **`lib/billing/sync.ts` is the only writer to the billing tables.** Gate
  features on `Entitlement`, never on Stripe or `Subscription` from UI code.
- **Spending money needs `assertAiBudget`** (`lib/ai/usage.ts`) *before* the
  provider call — kinds are `full_build`, `editor_prompt`, `chat_message`. The
  Redis cooldown fails open; the Postgres count is the real ceiling. Note a
  retarget makes a SECOND provider call, so the budget callback has to be
  threaded all the way down to `runPageEdit` — it is checked per call, though
  the ledger still counts one row per request.
- **A caller without a session gates INSIDE the mutating function.**
  `lib/ai/editor-prompt-run.ts`'s `runEditorPromptJob` and
  `lib/ai/revert-page-edit.ts`'s `revertPageEdit` both re-assert ownership and
  plan themselves rather than trusting `paidSiteProcedure` around them, because
  Slack reaches them with no session at all. Anything that gains a non-session
  caller must move its gate inward the same way, or the first non-negotiable
  above quietly stops being true. Slack's own channel/identity/entitlement
  check is `lib/slack/authorize.ts`, run on EVERY command — never once at
  connect time.
- **A Trigger.dev task must not import `next/font`.** Tasks are bundled by
  esbuild, where `next/font` (a build-time transform) throws at import. The
  font data a task transitively needs lives in `lib/theme/font-registry.ts`;
  `lib/theme/fonts.ts` holds the `next/font` calls and `app/layout.tsx` is its
  only importer. `tests/task-import-boundary.test.ts` enforces this.
- **Third-party bearer tokens are encrypted before they touch Postgres**
  (`lib/slack/crypto.ts`, AES-256-GCM). Env-var secrets stay in env.

## Design tokens

`app/globals.css` holds two families that must not be mixed:

- **App tokens** (`--surface`, `--brand`, `--editor-*`) → Regroup's own chrome
  (`bg-surface`, `text-muted`).
- **Site tokens** (`--color-primary`, `--font-primary`) → the *church's* brand,
  injected per request by `ThemeProvider`, read only through `site-` utilities
  (`bg-site-primary`).

Styling product chrome with a `site-` utility leaks a church's colours into the
dashboard. Renderer code must never hardcode a hex or font name.

## Conventions

- **Optional integrations degrade to off, never crash.** `resolveGhlConfig()`,
  `isSlackConfigured()`, `resolveGateway()` all return null/false when unset and
  the feature disappears from the UI. Follow that posture for anything new.
- Zod at every boundary; fonts and colours are restricted to registries because
  both become CSS custom properties on a public page.
- One AI edit path: the chatbot (`lib/ai/chat`) routes through the same
  `applyEditorAiPrompt` the editor's prompt box uses. Don't add a second, less
  validated way to touch a site.
- Model choice per agent role lives in `lib/ai/agents/model-config.ts`, driven
  by `AI_MODEL_<ROLE>` env vars. Changing a model is a deploy, not a code edit.
- Prisma retries connection failures inside the client extension
  (`lib/db/index.ts`). `withDbRetry` is deprecated; don't add new call sites.
- Redis is a performance layer only — every read path must work with it unset.
- `AGENTS.md` is generated by `next dev`. Don't hand-edit it; commit it with
  your work if it reappears.

## Before calling work done

Run `npm run verify` (typecheck + lint + tests). All three pass; `tests/`
exists and the suite is expected to stay green. Lint reports warnings from
the untracked `.agents/skills` and `.claude/skills` directories — those are
vendored tooling, not project source, and `0 errors` is the bar.
