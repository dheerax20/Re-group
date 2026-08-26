"use client";

import { Check, RotateCcw, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What happened to the last ticket, said in three words and a name.
 *
 * This is a full-bleed overlay rather than a banner, and that is the whole
 * point: a volunteer at a door reads it at arm's length, at a glance, while
 * already reaching for the next phone. A tone, a name, a time — nothing to
 * scroll, nothing to dismiss before the next person can be scanned.
 *
 * A success clears itself after a beat and hands the camera back. The two
 * states that need a decision — an unrecognised ticket, and someone who is
 * already inside — wait for a tap instead, because both usually mean a
 * conversation is about to happen.
 */

export type CheckinOutcome = "success" | "already" | "invalid";

export type CheckinResult = {
  outcome: CheckinOutcome;
  title: string;
  detail?: string;
  /** Present when a real registration was matched, enabling Undo. */
  registrationId?: string;
};

const TONE: Record<
  CheckinOutcome,
  { ring: string; chip: string; icon: typeof Check }
> = {
  success: {
    ring: "bg-success-soft",
    chip: "bg-success text-white",
    icon: Check,
  },
  already: {
    ring: "bg-warning-soft",
    chip: "bg-warning text-white",
    icon: TriangleAlert,
  },
  invalid: {
    ring: "bg-destructive-soft",
    chip: "bg-destructive text-white",
    icon: X,
  },
};

export function CheckinResultView({
  result,
  onDismiss,
  onUndo,
  className,
}: {
  result: CheckinResult;
  onDismiss: () => void;
  onUndo?: (registrationId: string) => void;
  className?: string;
}) {
  const tone = TONE[result.outcome];
  const Icon = tone.icon;

  return (
    <div
      aria-live="assertive"
      className={cn(
        "flex size-full flex-col items-center justify-center gap-5 px-8 text-center",
        tone.ring,
        className
      )}
      role="status"
    >
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          tone.chip
        )}
      >
        <Icon className="size-8" strokeWidth={2.5} />
      </span>

      <div className="space-y-1.5">
        <p className="text-xl font-semibold tracking-[-0.015em] text-foreground text-balance">
          {result.title}
        </p>
        {result.detail ? (
          <p className="text-[15px] text-muted">{result.detail}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button className="min-w-40" onClick={onDismiss} size="lg">
          {result.outcome === "success" ? "Done" : "Scan another ticket"}
        </Button>

        {result.registrationId && onUndo ? (
          <Button
            onClick={() => onUndo(result.registrationId!)}
            size="sm"
            variant="ghost"
          >
            <RotateCcw />
            Undo check-in
          </Button>
        ) : null}
      </div>
    </div>
  );
}
