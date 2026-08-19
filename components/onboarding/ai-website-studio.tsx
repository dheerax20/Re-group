"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import type { JobView } from "@/lib/ai/generation-job";
import { CREW_STEPS } from "@/lib/ai/agents/crew";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuroraField, CrewCircuit, ProgressRing } from "./wizard-art";

/**
 * Sites this page session has already auto-started a build for.
 *
 * Module scope on purpose — see the effect that reads it. Cleared on a real
 * page load, which is the correct lifetime: a fresh load re-reads the job from
 * the server and re-attaches rather than starting anything new.
 */
const autoStartedSites = new Set<string>();

/**
 * Watches a real build, live.
 *
 * Three versions of this have existed. The first advanced the step list on a
 * 3.5-second timer while the crew ran inside the request — the steps were
 * theatre and a closed tab lost the work. The second moved the crew to a job
 * row and polled it every 2.5s, which made the steps true but meant a request
 * per tick and a step that could be up to a poll interval stale.
 *
 * This one subscribes to the Trigger.dev run. Progress arrives when it
 * happens, there is no poll loop, and closing the tab is genuinely free: the
 * run is durable, and reopening the page hands this component the active run
 * id so it re-attaches to the same build rather than paying for a new one.
 */
export function AiWebsiteStudio({
  siteId,
  initialJob,
  initialToken,
}: {
  siteId: string;
  initialJob: JobView | null;
  initialToken: string | null;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [runId, setRunId] = useState<string | null>(initialJob?.triggerRunId ?? null);
  const [token, setToken] = useState<string | null>(initialToken);
  const [job, setJob] = useState<JobView | null>(initialJob);
  const [error, setError] = useState<string | null>(null);

  const startBuild = trpc.ai.startBuild.useMutation({
    onSuccess(result) {
      setRunId(result.runId);
      setToken(result.publicAccessToken);
      setJob(result.job ?? null);
      setError(null);
    },
    onError(err) {
      setError(err.message);
    },
  });

  /**
   * Start one automatically only when there is nothing to attach to.
   *
   * The guard is module-scoped (`autoStartedSites`), NOT a ref, and that
   * distinction is load-bearing. React StrictMode mounts this component twice
   * in development, which creates two component instances — each with its own
   * ref, each seeing an empty guard, each firing a mutation. tRPC's batch link
   * then packs both into a single `ai.startBuild,ai.startBuild` request. The
   * database rejects the second (one active job per site), so no church was
   * ever double-charged, but a guard that reliably fires twice is not a guard.
   *
   * Keyed by siteId so a genuine remount for a different site still starts.
   */
  useEffect(() => {
    if (runId || autoStartedSites.has(siteId)) return;
    const settled = job && job.status !== "QUEUED" && job.status !== "RUNNING";
    if (job && !settled) return;
    autoStartedSites.add(siteId);
    startBuild.mutate({ siteId });
  }, [runId, job, siteId, startBuild]);

  const { run } = useRealtimeRun(runId ?? "", {
    accessToken: token ?? undefined,
    enabled: Boolean(runId && token),
  });

  // The run's metadata is the live copy; the job row is what a reloaded client
  // resumes from. Prefer whichever is further along rather than assuming.
  const liveStep = Number(run?.metadata?.stepIndex ?? -1);
  const activeIndex = Math.max(liveStep, job?.stepIndex ?? 0, 0);

  const runFailed = run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "SYSTEM_FAILURE";
  const runDone = run?.status === "COMPLETED";
  const failed = runFailed || job?.status === "FAILED";
  const succeeded = runDone || job?.status === "SUCCEEDED";
  const running = !failed && !succeeded && (Boolean(runId) || startBuild.isPending);

  /**
   * The run finishing is the signal to re-read the site — the block tree was
   * committed by the task, not by anything this component called, so React
   * Query has no idea it changed.
   */
  useEffect(() => {
    if (!runDone) return;
    void utils.site.invalidate();
    void utils.ai.buildStatus.invalidate({ siteId });
    router.refresh();
  }, [runDone, utils, router, siteId]);

  // A failed run's message lives on the job row, which the task's `onFailure`
  // writes — the realtime payload only says that it failed, not why.
  useEffect(() => {
    if (!runFailed) return;
    void utils.ai.buildStatus.fetch({ siteId }).then((next) => {
      if (next?.job) setJob(next.job);
    });
  }, [runFailed, utils, siteId]);

  const shownError = error ?? (failed ? (job?.error ?? "The build stopped unexpectedly.") : null);
  const percent = succeeded
    ? 100
    : Math.round((Math.min(activeIndex, CREW_STEPS.length) / CREW_STEPS.length) * 100);

  return (
    <div className="space-y-8">
      <div className="relative isolate overflow-hidden rounded-3xl border border-editor-border bg-editor-panel p-6 text-editor-foreground shadow-[var(--shadow-lift)] sm:p-8">
        <AuroraField className="opacity-40" />

        <div className="relative flex items-start gap-4">
          <ProgressRing value={percent} size={52} className="shrink-0 text-white/30">
            <Sparkles className="size-5 text-accent" />
          </ProgressRing>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              AI design studio
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight">
              Designing your church homepage
            </h2>
            <p className="mt-2 max-w-xl text-sm text-editor-muted">
              Six specialists invent layout and copy. Photos stay empty on purpose —
              you&apos;ll add your own church images next.
            </p>
          </div>
        </div>

        <div className="relative mt-7 px-1 text-white/25">
          <CrewCircuit
            total={CREW_STEPS.length}
            activeIndex={activeIndex}
            complete={succeeded}
          />
        </div>

        <ol className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CREW_STEPS.map((step, index) => {
            const done = succeeded || index < activeIndex;
            const active = running && index === activeIndex;

            return (
              <li
                key={step.id}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-2xl border px-4 py-3 backdrop-blur-sm transition-colors",
                  active && "border-accent/50 bg-accent/15",
                  done && "border-white/10 bg-white/5",
                  !active && !done && "border-white/10 bg-black/20"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active && "bg-accent text-editor-shell",
                      done && "bg-success text-editor-shell",
                      !active && !done && "bg-white/10 text-white/50"
                    )}
                  >
                    {done ? (
                      <Check className="size-3" />
                    ) : active ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <p className="text-sm font-medium">{step.label}</p>
                </div>
                <p className="mt-1.5 pl-7 text-xs text-editor-muted">{step.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {shownError ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {shownError}
          </p>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setJob(null);
              setRunId(null);
              // An explicit retry is a deliberate act, so it clears the
              // auto-start guard rather than being suppressed by it.
              autoStartedSites.delete(siteId);
              startBuild.mutate({ siteId });
            }}
            disabled={startBuild.isPending}
          >
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {running
            ? "This takes about a minute. You can safely close this tab and come back — the build keeps going."
            : succeeded
              ? "Done. Loading your homepage…"
              : "Starting the crew…"}
        </p>
      )}
    </div>
  );
}
