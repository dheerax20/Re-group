import type { GenerationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { parseChurchStory, parseStyleName } from "@/lib/site/story";
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
 * There is no staleness sweep any more. The five-minute `STALE_JOB_MS`
 * heuristic existed because `after()` gave no way to tell a slow build from a
 * dead one, so a run killed between claiming a job and finishing it would
 * block that church's Rebuild button forever. A Trigger.dev run has a real,
 * observable status, and `onFailure` marks the row terminal — so a QUEUED or
 * RUNNING row now means the run is genuinely alive.
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

export async function createJob(
  siteId: string,
  kind: "full_build" | "editor_prompt",
  prompt?: string
): Promise<JobView> {
  const job = await prisma.siteGenerationJob.create({
    data: {
      siteId,
      kind,
      status: "QUEUED",
      totalSteps: kind === "full_build" ? CREW_STEPS.length : 1,
      prompt: prompt ?? null,
    },
  });
  return toView(job);
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

/** Terminal failure. The message is the one the church reads. */
export async function markJobFailed(jobId: string, message: string): Promise<void> {
  await prisma.siteGenerationJob.update({
    where: { id: jobId },
    data: { status: "FAILED", error: message, finishedAt: new Date() },
  });
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
    parseStyleName(site.storyConfig)
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
