"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { wizardSteps } from "@/lib/onboarding/steps";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const statusCopy: Record<string, string> = {
  church: "Gathering context for tone, size, and messaging.",
  social: "Mapping community links into navigation and footer.",
  brand: "Building your design tokens from colors and type.",
  features: "Scoping modules the AI crew will include.",
  templates: "AI crew is inventing layout, copy, and imagery…",
  publish: "Validating slug, SEO basics, and publish readiness.",
};

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
    <div className="border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <RegroupLogo href="/" />
        <p className="tabular-nums text-sm text-muted">
          {step + 1} / {wizardSteps.length}
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-6 pb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {wizardSteps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
                  i === step
                    ? "bg-brand text-brand-foreground"
                    : i < step
                      ? "text-foreground"
                      : "text-muted"
                )}
              >
                {s.label}
              </span>
              {i < wizardSteps.length - 1 ? (
                <span className="h-px w-4 bg-border" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>

        <Progress value={percent} className="h-1" />

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
