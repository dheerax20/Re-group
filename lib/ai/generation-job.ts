import type { GenerationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSite } from "@/lib/site/invalidate";
import { parseChurchStory, parseStyleName } from "@/lib/site/story";
import { coerceSections } from "@/lib/validation/section";
import { coerceBlocks } from "@/lib/site/blocks/schema";
import { getChurchWebsiteCrew } from "./multi-agent-site-builder";
import { CREW_STEPS } from "./agents/crew";
import {
  AI_GENERATED_TEMPLATE_ID,
  AI_GENERATED_TEMPLATE_VERSION,
} from "./agents/schemas";

/**
 * Runs the agent crew outside the request that asked for it.
 *
 * The crew is six sequential LLM calls — routinely a minute or more. Running it
 * inside the server action the browser was awaiting meant a closed tab or a
 * platform timeout threw away work that had already been paid for, and the
 * progress list could only ever be a `setInterval` guessing. Now the action
 * creates a row and returns; `after()` runs this; the client polls the row.
 *
 * A job is also the usage ledger — see `lib/ai/usage.ts`.
 */

/** Anything older than this with no result is a runner that died mid-flight. */
const STALE_JOB_MS = 5 * 60 * 1000;

export type JobView = {
  id: string;
  status: GenerationStatus;
  step: string | null;
  stepIndex: number;
  totalSteps: number;
  error: string | null;
  styleName: string | null;
  summary: string | null;
  createdAt: string;
  finishedAt: string | null;
};

function toView(job: {
  id: string;
  status: GenerationStatus;
  step: string | null;
  stepIndex: number;
  totalSteps: number;
  error: string | null;
  styleName: string | null;
  summary: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): JobView {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    stepIndex: job.stepIndex,
    totalSteps: job.totalSteps,
    error: job.error,
    styleName: job.styleName,
    summary: job.summary,
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
 * A QUEUED or RUNNING row older than `STALE_JOB_MS` is treated as dead and
 * marked failed rather than blocking the site forever — the alternative is a
 * church whose Rebuild button never works again because one invocation was
 * killed between claiming the job and finishing it.
 */
export async function findActiveJob(siteId: string, kind: string) {
  const active = await prisma.siteGenerationJob.findFirst({
    where: { siteId, kind, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return null;

  if (Date.now() - active.createdAt.getTime() > STALE_JOB_MS) {
    await prisma.siteGenerationJob.update({
      where: { id: active.id },
      data: {
        status: "FAILED",
        error: "The build stopped unexpectedly. Start it again.",
        finishedAt: new Date(),
      },
    });
    return null;
  }

  return active;
}

export async function getLatestJob(siteId: string, kind: string): Promise<JobView | null> {
  const active = await findActiveJob(siteId, kind);
  if (active) return toView(active);

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

/**
 * Executes a queued full build. Safe to call once per job id; a job not in
 * QUEUED is ignored, so a duplicate `after()` cannot double-charge.
 */
export async function runFullBuildJob(jobId: string): Promise<void> {
  const claimed = await prisma.siteGenerationJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const job = await prisma.siteGenerationJob.findUnique({
    where: { id: jobId },
    include: { site: true },
  });
  if (!job) return;

  const site = job.site;

  try {
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
        await prisma.siteGenerationJob.update({
          where: { id: jobId },
          data: { step: step.id, stepIndex: step.index },
        });
      },
      parseStyleName(site.storyConfig)
    );

    // The crew's output is model output: run it through the same repair the
    // read path uses so an invented block/URL cannot be persisted.
    //
    // The composed page goes to `blockConfig`, NOT `sectionConfig`. Those are
    // two different shapes, and `sectionConfig` still has other writers (the
    // visual editor, the AI chat editor, `enableFeatureOnSite`) that would
    // overwrite a block tree with legacy sections and destroy the build. It
    // also still holds the giving/YouTube/podcast URLs the read path derives.
    const blocks = built.blocks ? coerceBlocks(built.blocks) : [];
    const legacySections = built.blocks ? null : coerceSections(built.sections);

    await prisma.$transaction([
      prisma.site.update({
        where: { id: site.id },
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

    await invalidateSite(site.id, { slug: site.slug });
  } catch (error) {
    console.error(`[generation-job] ${jobId} failed`, error);
    const raw = error instanceof Error ? error.message : "AI website generation failed";
    const message = raw.includes("Invalid schema")
      ? "The AI returned an unusable layout. Try again."
      : raw.slice(0, 280);

    await prisma.siteGenerationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
  }
}
