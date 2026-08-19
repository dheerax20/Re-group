# tRPC + Trigger.dev Conversion — Full Task Specification (Current Codebase)

This spec is grounded in the codebase as it exists today (server actions,
LangChain + OpenAI crew, `SiteGenerationJob` polling, Auth0, Upstash Redis,
R2 uploads, Vercel custom domains, `proxy.ts` routing). It is ONE complete
task list — no phases. Everything below ships together.

**AI provider: OpenAI ONLY.** There is no Anthropic provider, no
`ANTHROPIC_API_KEY`, no provider-selection abstraction beyond what already
exists in `lib/ai/agents/model-config.ts`. Do not add one.

---

## 1. Goal

1. Replace all server actions and polling with **tRPC** (typed, single API
   surface) inside the existing Next.js app.
2. Move the AI crew build from `after()` + `SiteGenerationJob` polling to
   **Trigger.dev v3** with Realtime subscriptions (no more `STALE_JOB_MS`
   dead-runner heuristics, no more poll loop).
3. Keep every existing invariant intact: ownership + billing per procedure,
   AI budget layers, Redis caching + invalidation, block-tree validation,
   proxy routing, custom domain resolution. Nothing about the public render
   path changes.

## 2. What does NOT change

- `proxy.ts` — untouched. It never calls tRPC. Hostname resolution stays on
  `proxy-resolve.ts` + `/api/internal/hostname`.
- Public site rendering — `/sites/[siteSlug]` stays Server Components with
  direct Prisma/Redis reads (`get-published-site.ts`, `getCachedEvents`,
  `getCachedSermons`). No tRPC on public pages. ISR `revalidate = 300` stays.
- `app/api/uploads/route.ts` — stays a route handler (multipart + magic-byte
  checks don't belong in tRPC). Same for `/api/stripe/webhook` and
  `/api/internal/hostname`.
- `lib/site/invalidate.ts` — same single invalidation function, now called
  from procedures and Trigger.dev tasks instead of actions.
- Block schema, `coerceBlocks()`, `safeMediaUrl`, `safeLinkTarget`, recursion
  caps — unchanged. The write-site validation stays at the write site.
- `blockConfig` vs `sectionConfig` split — unchanged.
- Model config (`gpt-4o-mini` default, per-role `AI_MODEL_*` env overrides,
  `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_RETRIES`) — unchanged. LangChain +
  `@langchain/openai` stays.

## 3. Dependencies

```bash
npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query superjson
npm install @trigger.dev/sdk@latest
npx trigger.dev@latest init
```

Env additions:

```env
TRIGGER_SECRET_KEY=
```

Env removals: none to remove — `ANTHROPIC_API_KEY` was never added. Ensure it
is not introduced. `OPENAI_API_KEY` remains the only AI key; unset behavior
stays "builds fail fast with a clear message" (`resolveGateway()` null path).

## 4. File layout (additions)

```text
server/trpc/
├── trpc.ts                    # initTRPC + superjson + procedure builders
├── context.ts                 # Auth0 session, db, siteId ownership helpers
└── routers/
    ├── _app.ts
    ├── site.ts                # info, brand, features, sections, navigation, publish
    ├── social.ts
    ├── content.ts             # events + sermons CRUD
    ├── ai.ts                  # build trigger/status, editor prompt, chat
    ├── domains.ts
    └── media.ts

app/api/trpc/[trpc]/route.ts   # fetch adapter

trigger/
├── full-build.ts              # the crew as a Trigger.dev task
└── lib/
    └── progress.ts            # metadata helpers mapping CREW_STEPS → realtime

lib/trpc/
└── client.ts                  # typed React client + provider
```

## 5. tRPC foundation

### 5.1 Context (`server/trpc/context.ts`)

Built per-request from the fetch adapter:

- Auth0 session (same helper the actions use today).
- Prisma client.
- Nothing else. Ownership is checked per-procedure, not in context — mirrors
  the current "per action, not once at a layout boundary" rule.

### 5.2 Procedure builders (`server/trpc/trpc.ts`)

```ts
publicProcedure      // no session required (currently unused; exists for future)
authedProcedure      // Auth0 session required, else TRPCError UNAUTHORIZED
paidSiteProcedure    // authed + input contains siteId → requireOwnedPaidSite(siteId)
```

`paidSiteProcedure` is a middleware that reads `siteId` from the parsed input
and runs the existing `requireOwnedPaidSite`. Every mutation that touches a
site uses it. This replaces the copy-pasted first line of every server action
with one enforced middleware — it must be impossible to write a site mutation
that skips the check.

Error mapping: `requireOwnedPaidSite` failures → `FORBIDDEN` with the same
user-facing copy as today. Zod input failures → `BAD_REQUEST` (tRPC default).
Budget denials → `TOO_MANY_REQUESTS` with the existing message including the
reset date.

### 5.3 Transformer + serialization

`superjson` (Dates in events/sermons and job timestamps survive the wire).

## 6. Router inventory — every action converts

Reuse the exact Zod schemas from `lib/validation/*`. Do not fork them.

### site router

| Procedure | Type | Replaces | Notes |
|---|---|---|---|
| `site.get` | query | builder data loaders | Full owned-site payload for the workspace |
| `site.updateInfo` | mutation | `updateChurchInfo` | columns + `storyConfig` merge |
| `site.updateBrand` | mutation | `updateBrand` | `brandConfigSchema` |
| `site.updateFeatures` | mutation | `updateFeatures` | runs `validateFeatureDependencies` + regenerates `navigationConfig`, same as today |
| `site.updateSections` | mutation | `updateSections` | legacy `sectionConfig` writers keep working |
| `site.updateNavigation` | mutation | `updateNavigation` | keep the `allowedHrefs(features)` rejection |
| `site.publish` | mutation | `publishSite` | validation BEFORE any mutation (preserve the fixed ordering); slug re-check, both-slug invalidation on rename, `syncPrimaryDomain()` |
| `site.unpublish` | mutation | `unpublishSite` | |

### social router

| Procedure | Replaces | Notes |
|---|---|---|
| `social.update` | `updateSocialLinks` | transactional delete-all-then-recreate, unchanged |
| `social.updatePodcastRss` | podcast RSS save | `podcastRssSchema` |

### content router

| Procedure | Replaces | Notes |
|---|---|---|
| `content.createEvent` | `createEvent` | Same transaction: validate → unique slug (`-2`, `-3`) → insert → `enableFeatureOnSite(siteId, "events", { variant: "grid" })` → invalidate |
| `content.updateEvent` / `deleteEvent` | existing actions | |
| `content.createSermon` / `updateSermon` / `deleteSermon` | existing actions | identical pattern with `sermons` feature |
| `content.listEvents` / `listSermons` | builder list loaders | owned reads, NOT the cached public path |

### ai router

| Procedure | Type | Replaces |
|---|---|---|
| `ai.startBuild` | mutation | `startAiWebsiteBuild` |
| `ai.buildStatus` | query | `getAiWebsiteBuildStatus` (kept as fallback; primary is Realtime — see §7) |
| `ai.editorPrompt` | mutation | one-shot editor prompt (`lib/ai/editor-prompt.ts`), kind `editor_prompt` |
| `ai.chatSend` | mutation | chatbot send → `lib/ai/chat/graph.ts` LangGraph (classifier → answer/apply), 8-turn history cap, `appliedSummary` behavior unchanged |
| `ai.chatHistory` | query | ChatMessage list for the site |

`ai.editorPrompt` and `ai.chatSend` run **inline in the mutation** — they are
single LLM calls, well under timeout, and Trigger.dev overhead would only slow
them. Budget checks (`assertAiBudget`) run first, before any provider call,
exactly as today.

### domains router

| Procedure | Replaces | Notes |
|---|---|---|
| `domains.add` | add-domain action | Preserve the full sequence: rate limit 10/h/user → `validateHostname()` → 5-per-site cap → apex+www pairing → **Vercel call before any row** → `PENDING_*` row → immediate `refreshDomainStatus()` |
| `domains.remove` | existing | invalidate hostnames |
| `domains.refresh` | `refreshDomainStatus` | |
| `domains.list` | screen loader | includes the "feature off" state when `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` unset |

### media router

| Procedure | Notes |
|---|---|
| `media.list` / `media.delete` | Upload itself stays on the route handler |

### Deletion rule

A server action is deleted only after its procedure is wired AND the UI is
migrated. At the end: `lib/site/actions.ts`, `lib/site/content-actions.ts`,
`lib/domains/actions.ts` contain no exported actions (internal helpers like
`requireOwnedPaidSite`, `enableFeatureOnSite`, `syncPrimaryDomain` move to
plain lib functions the routers import).

## 7. Trigger.dev — the crew build

### 7.1 What replaces what

| Today | After |
|---|---|
| `after(() => runFullBuildJob(job.id))` | `tasks.trigger("full-build", payload, { idempotencyKey })` |
| Client polls `getAiWebsiteBuildStatus` | `useRealtimeRun(runId)` subscription |
| `STALE_JOB_MS` 5-min dead-runner sweep | Deleted — Trigger.dev owns run liveness |
| Conditional `updateMany` on `status: "QUEUED"` claim | Deleted — no duplicate-runner problem; idempotencyKey covers duplicate triggers |
| Job progress writes (`step`, `stepIndex`) | `metadata.set()` on the run, mirrored to the job row |

### 7.2 Keep the `SiteGenerationJob` row

Do NOT delete the model. It is the **budget ledger** ("counting rows rather
than a separate counter means the ledger and the audit trail are the same
record") and the audit log. The task writes to it at start
(`RUNNING`, now also storing `triggerRunId`), progress, and terminal state
(`SUCCEEDED`/`FAILED` + log + summary). A failed run still counts against the
monthly cap — unchanged.

### 7.3 `ai.startBuild` mutation

```ts
// server/trpc/routers/ai.ts
startBuild: paidSiteProcedure
  .input(z.object({ siteId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const active = await findActiveJob(input.siteId);
    if (active?.triggerRunId) {
      return { runId: active.triggerRunId, publicAccessToken: await reissueToken(active.triggerRunId) };
    }
    await assertAiBudget(ctx.userId, "full_build");   // Redis cooldown + Postgres cap, BEFORE anything
    const job = await createJob(input.siteId);         // QUEUED, ledger row
    const handle = await tasks.trigger<typeof fullBuildTask>(
      "full-build",
      { siteId: input.siteId, jobId: job.id },
      { idempotencyKey: `build-${job.id}` },
    );
    await db.siteGenerationJob.update({ where: { id: job.id }, data: { triggerRunId: handle.id } });
    return { runId: handle.id, publicAccessToken: handle.publicAccessToken };
  }),
```

Schema change: add `triggerRunId String?` to `SiteGenerationJob` + migration.

### 7.4 The task (`trigger/full-build.ts`)

```ts
export const fullBuildTask = task({
  id: "full-build",
  maxDuration: 600,                      // crew is routinely >1 min; headroom for retries
  retry: { maxAttempts: 1 },             // do NOT auto-retry the whole crew: each attempt costs 6 LLM calls and budget already counted the job
  run: async ({ siteId, jobId }) => {
    await markJobRunning(jobId);
    // The existing crew, unchanged internally:
    // pickArtDirection (avoids previous styleName) → CREW_STEPS pipeline
    // producer+theme-director single call → layout-architect block tree →
    // copywriter SEO → media-director (concurrent, no-op .catch()) → responsive-qa
    // structuredChain() with toOpenAiJsonSchema oneOf→anyOf fix — all untouched.
    const result = await runCrewBuild(siteId, {
      onProgress: async (step, stepIndex) => {
        metadata.set("step", step);
        metadata.set("stepIndex", stepIndex);
        await writeJobProgress(jobId, step, stepIndex).catch(() => {}); // progress write must never fail a good build
      },
    });
    // Write site (same transaction as today): coerceBlocks() at the write site,
    // blockConfig / navigationConfig / seoConfig / storyConfig merge, job → SUCCEEDED.
    await commitBuild(siteId, jobId, result);
    await invalidateSite(siteId);
    return { siteId };
  },
  onFailure: async ({ payload, error }) => {
    await markJobFailed(payload.jobId, trimTo280(rewriteSchemaError(error))); // "Invalid schema" → "The AI returned an unusable layout. Try again."
  },
});
```

`runCrewBuild` is `runFullBuildJob` refactored to take an `onProgress`
callback and return the result instead of committing — extraction, not
rewrite. LangChain per-call timeout/retry config stays inside it.

### 7.5 Frontend

- Step 5 of the wizard + the Rebuild button call `ai.startBuild`, then render
  progress from `useRealtimeRun(runId, { accessToken })`, mapping
  `metadata.step` to the same `CREW_STEPS` labels the poller shows today.
- On COMPLETED → invalidate `site.get` via React Query → preview re-renders
  the new block tree.
- On page refresh mid-build: `ai.buildStatus` returns the active job's
  `triggerRunId`; client re-subscribes. The polling query is thus demoted to
  a resume mechanism, not a loop.
- On FAILED → show the job row's trimmed message + Rebuild (budget permitting).

## 8. React Query / client rules

- Provider wraps the authenticated app layout only (dashboard, builder,
  domains). Marketing pages and `/sites/*` are outside it.
- Optimistic updates on: brand color/font changes, feature toggles,
  navigation edits, event/sermon list mutations. Rollback on error.
- After every mutation, invalidate the narrowest query (`site.get` for site
  mutations, `content.listEvents` for event mutations, etc.). Server-side
  `invalidateSite()` handles public caches; React Query handles the editor.

## 9. Invariants checklist (must all survive the migration)

- [ ] Ownership + billing enforced on EVERY site mutation via
      `paidSiteProcedure` — no procedure can opt out silently.
- [ ] `assertAiBudget` before every provider call; failed builds still count;
      chat metered on USER messages; reset date named in the error.
- [ ] Redis fail-open everywhere; Postgres monthly cap cannot be flushed.
- [ ] `updateNavigation` rejects hrefs outside `allowedHrefs(features)`.
- [ ] Publish validates before mutating; slug rename invalidates both slugs.
- [ ] Domain add calls Vercel before writing rows; only ACTIVE + PUBLISHED
      resolve; apex+www pairing preserved.
- [ ] `coerceBlocks()` still guards the single write site for block trees;
      depth 6, children caps, URL sanitizers.
- [ ] Chatbot still routes edits through `applyEditorAiPrompt` — one
      validated write path for AI edits, not two.
- [ ] Unset `OPENAI_API_KEY` → build fails fast with the existing message.
      No Anthropic key, no second provider, anywhere.
- [ ] `proxy.ts` order of operations untouched (stripe webhook first, Auth0,
      platform paths/hosts, slug, custom domain, cookie-copying rewrite).

## 10. Definition of Done

- Zero exported server actions remain; the builder, wizard, dashboard,
  domains, and chat all speak tRPC.
- A full build: click → `ai.startBuild` returns in <500ms → live
  `CREW_STEPS` progress via Realtime → block tree committed → preview
  updates — with the tab closed mid-build, the site still finishes and the
  job row still records it.
- Double-click on Rebuild produces one run (idempotencyKey) and one budget
  charge.
- `getAiWebsiteBuildStatus` polling loop and `STALE_JOB_MS` sweep are
  deleted.
- Typecheck clean, no `any` at router boundaries, all existing Zod schemas
  reused not duplicated.