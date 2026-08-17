"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import {
  getAiWebsiteBuildStatus,
  startAiWebsiteBuild,
} from "@/lib/site/actions";
import type { JobView } from "@/lib/ai/generation-job";
import { CREW_STEPS } from "@/lib/ai/agents/crew";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How often to ask the server where the build is. */
const POLL_MS = 2500;

/**
 * Watches a real build.
 *
 * The previous version started the crew inside the request it was rendering in
 * and advanced this list on a 3.5-second timer, so the steps were theatre and a
 * closed tab lost the work. Now the server owns a job row: this component asks
 * it to start one, then polls, so the step shown is the specialist actually
 * running and a refresh rejoins the same build instead of paying for a new one.
 */
export function AiWebsiteStudio({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const result = await startAiWebsiteBuild(siteId);
      setJob(result.job ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the build.");
    } finally {
      setStarting(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  // Poll while the build is in flight. Stops on its own once the job settles,
  // so a finished build costs nothing.
  useEffect(() => {
    if (!job || (job.status !== "QUEUED" && job.status !== "RUNNING")) return;

    const timer = window.setInterval(async () => {
      try {
        const next = await getAiWebsiteBuildStatus(siteId);
        if (!next) return;
        setJob(next);
        if (next.status === "SUCCEEDED") {
          router.refresh();
        }
      } catch {
        // A dropped poll is not a failed build — the next tick tries again.
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [job, siteId, router]);

  const activeIndex = job?.stepIndex ?? 0;
  const failed = job?.status === "FAILED";
  const running = job?.status === "QUEUED" || job?.status === "RUNNING";
  const shownError = error ?? (failed ? job?.error : null);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-editor-border bg-editor-panel p-6 text-editor-foreground shadow-[var(--shadow-lift)] sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              AI design studio
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight">
              Building a cinematic church homepage
            </h2>
            <p className="mt-2 max-w-xl text-sm text-editor-muted">
              Specialists invent layout and copy. Photos stay empty — you&apos;ll add
              your own church images next.
            </p>
          </div>
        </div>

        <ol className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CREW_STEPS.map((step, index) => {
            const done = index < activeIndex || job?.status === "SUCCEEDED";
            const active = running && index === activeIndex;

            return (
              <li
                key={step.id}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-2xl border px-4 py-3 transition-colors",
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
          <Button type="button" onClick={() => void start()} disabled={starting}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {running
            ? "This takes about a minute. You can safely close this tab and come back — the build keeps going."
            : starting
              ? "Starting the crew…"
              : "Finishing up…"}
        </p>
      )}
    </div>
  );
}
