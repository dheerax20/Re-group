"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { wizardSteps } from "@/lib/onboarding/steps";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { cn } from "@/lib/utils";
import { CrewCircuit, ProgressRing } from "./wizard-art";

const statusCopy: Record<string, string> = {
  church: "Gathering context for tone, size, and messaging.",
  social: "Mapping community links into navigation and footer.",
  brand: "Building your design tokens from colors and type.",
  features: "Scoping modules the AI crew will include.",
  templates: "AI crew is inventing layout, copy, and imagery…",
  publish: "Validating slug, SEO basics, and publish readiness.",
};

/**
 * The wizard's header: where you are, and what the system is doing about it.
 *
 * The plain `<Progress>` bar was replaced by the same `CrewCircuit` the build
 * screen uses. That is not decoration for its own sake — the wizard and the
 * build are one continuous process to the person walking through it, and
 * having the six steps drawn the same way in both places is what makes the
 * final "designing your homepage" screen read as the end of this bar rather
 * than as a different product.
 */
export function StepProgress() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (pathname === "/builder") return null;

  const currentIndex = wizardSteps.findIndex(
    (s) => pathname === `/builder/${s.path}` || pathname.startsWith(`/builder/${s.path}/`)
  );
  const step = currentIndex === -1 ? 0 : currentIndex;
  const percent = ((step + 1) / wizardSteps.length) * 100;
  const current = wizardSteps[step];

  return (
    <div className="border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <RegroupLogo href="/" />
        <div className="flex items-center gap-3">
          <p className="tabular-nums text-sm text-muted">
            {step + 1} / {wizardSteps.length}
          </p>
          <ProgressRing value={percent} size={34} className="text-border">
            <span className="text-[10px] font-bold tabular-nums text-foreground">
              {Math.round(percent)}
            </span>
          </ProgressRing>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-3 px-6 pb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {wizardSteps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    active && "bg-brand text-brand-foreground shadow-[var(--shadow-soft)]",
                    done && "text-foreground",
                    !active && !done && "text-muted"
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : null}
                  {s.label}
                </span>
                {i < wizardSteps.length - 1 ? (
                  <span className="h-px w-4 bg-border" aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="text-border">
          <CrewCircuit total={wizardSteps.length} activeIndex={step} className="h-8" />
        </div>

        <motion.div
          key={current?.key}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/40 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Generating</span>
            {" · "}
            {statusCopy[current?.key ?? "church"]}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
