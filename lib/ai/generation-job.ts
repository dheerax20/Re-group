import type { GenerationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { parseChurchStory, parseHeroImage, parseStyleName } from "@/lib/site/story";
import { coerceSections } from "@/lib/validation/section";
import { coerceBlocks } from "@/lib/site/blocks/schema";
import { getChurchWebsiteCrew } from "./multi-agent-site-builder";
import { CREW_STEPS } from "./agents/crew";
import type { ChurchWebsiteBuild } from "./agents/crew";
import {
  AI_GENERATED_TEMPLATE_ID,
  AI_GENERATED_TEMPLATE_VERSION,
} from "./agents/schemas";

/**
 * The generation job — the ledger and audit trail for one AI build.
 *
 * The crew itself no longer runs here. It runs as a Trigger.dev task
 * (`trigger/full-build.ts`), which owns run liveness: a killed invocation is
 * Trigger.dev's problem to report, not something this app infers from a
 * timestamp. What is left in this file is everything that is genuinely about
 * the job row rather than about executing it — creating it, reading it,
 * writing progress, and committing a finished build.
 *
 * The row survives that move on purpose. It is the budget ledger — counting
 * rows rather than keeping a separate counter means the ledger and the audit
 * trail are the same record, and a failed job still counts because the
 * provider was still called.
 */

export type JobView = {
  id: string;
  status: GenerationStatus;
  step: string | null;
  stepIndex: number;
  totalSteps: number;
  error: string | null;
  styleName: string | null;
  summary: string | null;
  triggerRunId: string | null;
  createdAt: string;
  finishedAt: string | null;
};

type JobRow = {
  id: string;
  status: GenerationStatus;
  step: string | null;
  stepIndex: number;
  totalSteps: number;
  error: string | null;
  styleName: string | null;
  summary: string | null;
  triggerRunId: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

function toView(job: JobRow): JobView {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    stepIndex: job.stepIndex,
    totalSteps: job.totalSteps,
    error: job.error,
    styleName: job.styleName,
    summary: job.summary,
    triggerRunId: job.triggerRunId,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * A job already in flight for this site, if any.
 *
 * The old five-minute `STALE_JOB_MS` sweep is gone, but NOT because a
 * QUEUED row can be trusted to mean "alive" — that assumption was wrong and
 * cost a jammed Rebuild button in practice. `onFailure` covers a run that
 * starts and dies; it does not cover a run nothing ever accepts, which stays
 * queued indefinitely and fails nothing.
 *
 * What replaced the timeout is `reconcileJobWithRun` (`./reconcile-run.ts`),
 * which asks Trigger.dev what actually became of the run instead of guessing
 * from elapsed time. Callers that surface an in-flight job to a user should
 * go through it rather than reading this directly.
 */
export async function findActiveJob(siteId: string, kind: string) {
  return prisma.siteGenerationJob.findFirst({
    where: { siteId, kind, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestJob(siteId: string, kind: string): Promise<JobView | null> {
  const latest = await prisma.siteGenerationJob.findFirst({
    where: { siteId, kind },
    orderBy: { createdAt: "desc" },
  });
  return latest ? toView(latest) : null;
}

/**
 * Claims the one active job slot for this (site, kind), or reports that
 * somebody already holds it.
 *
 * A `findActiveJob` check followed by a create is not safe: two clicks 200ms
 * apart both passed the check before either row existed, and both charged the
 * budget. The partial unique index added in
 * `20260819140000_one_active_job_per_site` is what makes the second insert
 * lose, deterministically — the only account of "already running" that
 * cannot race.
 *
 * `createManyAndReturn` with `skipDuplicates` rather than `create` in a
 * try/catch: both resolve the conflict at the database with the same
 * `INSERT ... ON CONFLICT DO NOTHING` Postgres uses for either, but `create`
 * makes the client throw P2002 on the (expected, routine) losing case, and
 * Prisma's query-engine logs that as an `error`-level line before the catch
 * ever runs — a double-click looks like a crash in the server log. Losing the
 * race here is just an empty array, not an exception.
 */
export async function claimJob(
  siteId: string,
  kind: "full_build" | "editor_prompt",
  prompt?: string,
  /**
   * Which surface asked for this job. Written with the row rather than
   * updated afterwards: a follow-up write is one more thing that can fail
   * between claiming the slot and spending money on it.
   */
  origin?: {
    source: string;
    slackChannelId?: string | null;
    slackUserId?: string | null;
    /**
     * The Trigger.dev run executing this claim, when the claim happens INSIDE
     * a task.
     *
     * Written with the row rather than through `attachRunId` afterwards,
     * because there is no safe window in between: the Slack path creates its
     * job inside the run, so a row that fails to record its run id can never
     * be reconciled and — since only one active job per (site, kind) may
     * exist — jams every later edit permanently. See `./reconcile-run.ts`.
     */
    triggerRunId?: string | null;
  }
): Promise<{ claimed: true; job: JobView } | { claimed: false; job: JobView | null }> {
  const created = await prisma.siteGenerationJob.createManyAndReturn({
    data: [
      {
        siteId,
        kind,
        status: "QUEUED",
        totalSteps: kind === "full_build" ? CREW_STEPS.length : 1,
        prompt: prompt ?? null,
        source: origin?.source ?? "web",
        slackChannelId: origin?.slackChannelId ?? null,
        slackUserId: origin?.slackUserId ?? null,
        triggerRunId: origin?.triggerRunId ?? null,
      },
    ],
    skipDuplicates: true,
  });

  if (created.length > 0) {
    return { claimed: true, job: toView(created[0]) };
  }

  const existing = await findActiveJob(siteId, kind);
  return { claimed: false, job: existing ? toView(existing) : null };
}

/** Records which Trigger.dev run is executing this job, for resume-on-reload. */
export async function attachRunId(jobId: string, triggerRunId: string): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { triggerRunId },
  });
}

export async function markJobRunning(jobId: string): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function writeJobProgress(
  jobId: string,
  step: string,
  stepIndex: number
): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { step, stepIndex },
  });
}

/**
 * Terminal success for a job the caller ran inline (the editor prompt).
 *
 * The full build does not use this — it commits the site and the job in one
 * transaction, so that path cannot leave one written without the other.
 *
 * Marking inline jobs terminal is not optional bookkeeping: only one active
 * job per (site, kind) may exist, so a row left QUEUED would make the NEXT
 * editor prompt fail to claim a slot.
 */
export async function markJobSucceeded(jobId: string, summary: string): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", summary, stepIndex: 1, finishedAt: new Date() },
  });
}

/** Terminal failure. The message is the one the church reads. */
export async function markJobFailed(jobId: string, message: string): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { status: "FAILED", error: message, finishedAt: new Date() },
  });
}

/**
 * Whether a job row is still claiming to be in flight.
 *
 * `finishedAt` is not consulted on purpose — the status column is what
 * `findActiveJob` and the unique index both key on, so it is the only
 * definition of "active" that all three agree about.
 */
export function isActiveStatus(status: GenerationStatus): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

/**
 * Turns whatever the crew threw into copy a church can act on.
 *
 * A raw "Invalid schema" is the model having produced something unusable, and
 * saying so is more useful than surfacing a zod dump onto a progress screen.
 */
export function describeBuildFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : "AI website generation failed";
  return raw.includes("Invalid schema")
    ? "The AI returned an unusable layout. Try again."
    : raw.slice(0, 280);
}

export type CrewProgressCallback = (step: string, stepIndex: number) => Promise<void> | void;

/**
 * Runs the six-agent crew for a site and returns the result WITHOUT writing it.
 *
 * Split from the commit so the Trigger.dev task can report progress between
 * the two and so a build that produced nothing usable never gets half-written.
 * The crew itself is untouched — same art direction picking, same concurrent
 * media director, same structured-output handling.
 */
export async function runCrewBuild(
  siteId: string,
  onProgress?: CrewProgressCallback
): Promise<{ built: ChurchWebsiteBuild; site: { id: string; slug: string } }> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const built = await getChurchWebsiteCrew().build(
    {
      siteId: site.id,
      churchName: site.name,
      tagline: site.tagline ?? undefined,
      denomination: site.denomination ?? undefined,
      congregationSize: site.congregationSize ?? undefined,
      brand: site.brandConfig as never,
      features: site.featureConfig as never,
      templateId: AI_GENERATED_TEMPLATE_ID,
      story: parseChurchStory(site.storyConfig),
    },
    async (step) => {
      await onProgress?.(step.id, step.index);
    },
    parseStyleName(site.storyConfig),
    parseHeroImage(site.storyConfig)
  );

  return { built, site: { id: site.id, slug: site.slug } };
}

/**
 * Persists a finished build.
 *
 * The crew's output is model output: it runs through the same repair the read
 * path uses so an invented block or URL cannot be persisted.
 *
 * The composed page goes to `blockConfig`, NOT `sectionConfig`. Those are two
 * different shapes, and `sectionConfig` still has other writers (the AI chat
 * editor, `enableFeatureOnSite`) that would overwrite a block tree with legacy
 * sections and destroy the build. It also still holds the giving/YouTube/
 * podcast URLs the read path derives.
 */
export async function commitBuild(
  siteId: string,
  jobId: string,
  built: ChurchWebsiteBuild,
  slug?: string
): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { slug: true, storyConfig: true },
  });
  if (!site) throw new Error("Site not found");

  const blocks = built.blocks ? coerceBlocks(built.blocks) : [];
  const legacySections = built.blocks ? null : coerceSections(built.sections);

  /**
   * Secondary pages are deliberately NOT seeded here.
   *
   * Writing a row at build time froze the page: `/about`'s default composition
   * reads `brand.tagline` and `features.ministries`, so a church that changed
   * their tagline afterwards would see the homepage regenerate while `/about`
   * kept the old wording forever, with no UI to fix it. Leaving the row absent
   * means `getPageBlocks` recomputes the default on every render — and the
   * first actual edit creates the row, which is the only moment a stored
   * version is genuinely wanted.
   */
  await prisma.$transaction([
    prisma.site.update({
      where: { id: siteId },
      data: {
        templateId: AI_GENERATED_TEMPLATE_ID,
        templateVersion: AI_GENERATED_TEMPLATE_VERSION,
        ...(legacySections ? { sectionConfig: toJson(legacySections) } : {}),
        blockConfig: blocks.length > 0 ? toJson(blocks) : undefined,
        navigationConfig: toJson(built.navigation),
        seoConfig: toJson(built.seo),
        storyConfig: toJson({
          ...parseChurchStory(site.storyConfig),
          improvements: built.improvements,
          designFeedback: built.designFeedback,
          mobileFeedback: built.mobileFeedback,
          agentLog: built.log,
          styleName: built.styleName,
          navVariant: built.navVariant,
          // Read back on the next build as `avoid`, so a regeneration onto a
          // new direction does not reuse the same photograph.
          heroImageUrl: built.heroImageUrl,
        }),
      },
    }),
    prisma.siteGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        step: null,
        stepIndex: CREW_STEPS.length,
        styleName: built.styleName,
        summary: `Built a ${built.styleName} homepage.`,
        log: toJson(built.log),
        finishedAt: new Date(),
      },
    }),
  ]);

  await invalidateSite(siteId, { slug: slug ?? site.slug });
}
