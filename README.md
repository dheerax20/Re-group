# Regroup — Church Website Builder (MVP)

A multi-tenant-ready church website builder. One Next.js application serves
every church — each site is a row in Postgres rendered through a shared
Template + Theme + Feature engine, not a separate deployment.

No authentication in this MVP by design (see the task spec). Anyone with a
`siteId` can edit that draft in the builder — this is intentional for the
MVP and is the first thing to lock down when auth is added.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma ·
Zod · React Hook Form · LangChain (`langchain` + `@langchain/openai`) for
the AI-ready template recommendation engine.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and point `DATABASE_URL` at a Postgres
   database (a local one is fine — `docker run -p 5432:5432 -e
   POSTGRES_PASSWORD=postgres postgres` works). `OPENAI_API_KEY` is
   optional — leave it blank and the app uses the deterministic
   rule-based recommendation engine.

3. **Set up the database**

   ```bash
   npm run db:push    # create tables from prisma/schema.prisma
   npm run db:seed     # seed 3 templates + a demo church ("Grace Community Church")
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   - Website builder wizard: http://localhost:3000/builder
   - Demo published site: http://grace-community.localhost:3000
     (most browsers/OS resolve `*.localhost` to loopback automatically —
     this exercises the same host-based tenant routing used in production)

## How multi-tenancy works

`middleware.ts` reads the request hostname. If it matches
`<slug>.regroup.app` (or `<slug>.localhost` in dev), the request is
rewritten internally to `/sites/<slug>/...`. Every public site page lives
under `app/sites/[siteSlug]/`; the renderer never knows or cares how the
tenant was resolved (see `lib/domains/tenant-resolver.ts`). This is the
same shape that supports future custom-domain support without touching
the renderer.

## Where things live

- `lib/site` — SiteConfig type, Zod validation, navigation generation,
  publish validation, server actions for the onboarding/builder CRUD flow.
- `lib/templates` — the 3 seeded `TemplateDefinition`s (modern / editorial
  / minimal) and the registry.
- `lib/features` — `FeatureConfig`, defaults, and the single source of
  truth for feature dependency rules (e.g. sermon search requires sermons).
- `lib/theme` — `BrandConfig`, the approved font registry, and CSS-variable
  generation so templates never hardcode colors/fonts.
- `lib/ai` — `TemplateRecommendationEngine` (rule-based + LangChain-backed)
  and `SiteGenerationProvider` (deterministic; AI can implement the same
  interface later). AI only ever returns JSON, never React code.
- `components/website/sections` — the actual section components (hero,
  sermons, events, ...), each with 2-3 variants.
- `components/website/renderer` — the fixed `sectionRegistry` and
  `WebsiteRenderer`. Components are resolved only through this registry —
  never from user input — so untrusted data can't trigger arbitrary
  component execution.
- `app/(platform)/builder` — website builder wizard + site editor
  (`/builder` → church/brand/features/templates/publish, then
  `/builder/[siteId]` for ongoing edits).
- `app/sites/[siteSlug]` — the public, published website.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push `prisma/schema.prisma` to the database (no migration history) |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:seed` | Seed templates + the demo church |
| `npm run db:studio` | Open Prisma Studio |

## What's intentionally not built (see task spec §3, §46)

Authentication, billing, custom domain provisioning, a full CMS, YouTube /
podcast sync workers, analytics, and AI-generated React code are out of
scope for this MVP. Interfaces (`StorageProvider`, `TenantResolver`,
`MediaProvider`, `PodcastProvider`, `SiteGenerationProvider`) are shaped so
none of that requires rewriting the website engine.
