"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Keyboard,
  QrCode,
  RotateCcw,
  ScanLine,
  Users,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import type { EventAttendance, RegistrationRow } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QrScanner } from "@/components/checkin/qr-scanner";
import {
  CheckinResultView,
  type CheckinResult,
} from "@/components/checkin/checkin-result";
import { ManualCheckin } from "@/components/checkin/manual-checkin";
import { cn } from "@/lib/utils";

/**
 * Audible + haptic confirmation.
 *
 * A volunteer scanning a queue is looking at the ticket, not at our screen, so
 * the result has to be perceivable without reading. Synthesised rather than an
 * audio file: no asset to ship, no request to fail, and it works the first time
 * offline. Both APIs are best-effort — iOS ignores `vibrate` entirely, and
 * audio is blocked until the page has been interacted with, which by this point
 * it always has (the volunteer tapped "Scan QR").
 */
function signal(tone: "success" | "warning" | "error") {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = tone === "success" ? 880 : tone === "warning" ? 560 : 220;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => void ctx.close();
    }
  } catch {
    // No audio available. The result screen still says what happened.
  }

  try {
    navigator.vibrate?.(tone === "success" ? 40 : [30, 60, 30]);
  } catch {
    // Not supported. Same fallback.
  }
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StatTile({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface px-3 py-3 text-center",
        emphasis && "border-brand/25 bg-brand-soft"
      )}
    >
      <p
        className={cn(
          "tabular text-2xl font-semibold leading-none text-foreground",
          emphasis && "text-brand-strong"
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
    </div>
  );
}

/**
 * The door.
 *
 * Two screens, not one. The **home** screen is where a volunteer stands
 * between rushes: the counts, one big Scan button, manual search, and who just
 * arrived. The **scanner** is a full-screen camera with nothing on it but the
 * frame and a way back — no tiles, no lists, no chrome, because a person
 * pointing a phone at a ticket has exactly one thing to do.
 *
 * The whole route is immersive (`isImmersiveRoute`), so the sidebar and top bar
 * are gone. That makes the back arrow in this header the ONLY way out, which is
 * why it is the first thing in the DOM and never scrolls away.
 */
export function CheckinExperience({
  siteId,
  eventId,
  eventTitle,
  initialAttendance,
  initialRegistrations,
}: {
  siteId: string;
  eventId: string;
  eventTitle: string;
  initialAttendance: EventAttendance;
  initialRegistrations: RegistrationRow[];
}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attendance = trpc.content.eventAttendance.useQuery(
    { siteId, eventId },
    {
      initialData: initialAttendance,
      // The counters are the only thing a second volunteer's scan changes on
      // this screen, and they are cheap.
      refetchInterval: 15_000,
    }
  );

  const registrations = trpc.content.listRegistrations.useQuery(
    { siteId, eventId },
    { initialData: initialRegistrations, staleTime: 5_000 }
  );

  const checkInByQr = trpc.content.checkInByQr.useMutation();
  const checkInManually = trpc.content.checkInManually.useMutation();
  const undoCheckIn = trpc.content.undoCheckIn.useMutation();

  const refresh = useCallback(async () => {
    await Promise.all([
      utils.content.eventAttendance.invalidate({ siteId, eventId }),
      utils.content.listRegistrations.invalidate({ siteId, eventId }),
    ]);
  }, [utils, siteId, eventId]);

  const clearTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  /**
   * Both check-in paths land here, so the screen and the sound are identical
   * whichever way the volunteer got there.
   */
  const present = useCallback(
    (outcome: Awaited<ReturnType<typeof checkInByQr.mutateAsync>>) => {
      if (outcome.ok && outcome.outcome === "checked_in") {
        const guests = outcome.registration.guestCount;
        setResult({
          outcome: "success",
          title: "Checked in",
          detail: [
            outcome.registration.attendeeName,
            guests > 0 ? `+${guests} guest${guests > 1 ? "s" : ""}` : null,
            formatTime(outcome.registration.checkedInAt),
          ]
            .filter(Boolean)
            .join(" · "),
          registrationId: outcome.registration.id,
        });
        signal("success");

        // A success hands the camera straight back, so a queue can be scanned
        // without a tap between people.
        clearTimer();
        dismissTimer.current = setTimeout(() => setResult(null), 1800);
        return;
      }

      if (outcome.ok) {
        setResult({
          outcome: "already",
          title: "Already checked in",
          detail: `${outcome.registration.attendeeName} · arrived ${formatTime(
            outcome.registration.checkedInAt
          )}`,
          registrationId: outcome.registration.id,
        });
        signal("warning");
        return;
      }

      setResult({
        outcome: "invalid",
        title:
          outcome.reason === "wrong_event"
            ? "Wrong event"
            : outcome.reason === "cancelled"
              ? "Registration cancelled"
              : "QR not recognised",
        detail:
          outcome.message ||
          "This ticket couldn't be matched to this event. Try manual check-in.",
      });
      signal("error");
    },
    [clearTimer]
  );

  const submitToken = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        present(await checkInByQr.mutateAsync({ siteId, eventId, raw }));
        await refresh();
      } catch (error) {
        setResult({
          outcome: "invalid",
          title: "Could not check in",
          detail: error instanceof Error ? error.message : "Try again.",
        });
        signal("error");
      } finally {
        busyRef.current = false;
      }
    },
    [checkInByQr, siteId, eventId, present, refresh]
  );

  async function onManualCheckIn(registrationId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(registrationId);
    try {
      present(await checkInManually.mutateAsync({ siteId, registrationId }));
      await refresh();
    } catch (error) {
      setResult({
        outcome: "invalid",
        title: "Could not check in",
        detail: error instanceof Error ? error.message : "Try again.",
      });
      signal("error");
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  async function onUndo(registrationId: string) {
    setBusyId(registrationId);
    try {
      await undoCheckIn.mutateAsync({ siteId, registrationId });
      clearTimer();
      setResult(null);
      await refresh();
      router.refresh();
    } catch {
      setResult({
        outcome: "invalid",
        title: "Could not undo",
        detail: "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function onCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    const raw = manualCode.trim();
    if (!raw) return;
    setManualCode("");
    await submitToken(raw);
  }

  const stats = attendance.data ?? initialAttendance;
  const rows = registrations.data ?? initialRegistrations;

  const recent = [...rows]
    .filter((row) => row.checkedInAt)
    .sort(
      (a, b) =>
        new Date(b.checkedInAt!).getTime() - new Date(a.checkedInAt!).getTime()
    )
    .slice(0, 25);

  /**
   * The scanner takes over the viewport completely. Rendered instead of the
   * home screen rather than on top of it, so the camera is never competing with
   * counters for a phone's short screen.
   */
  if (scanning) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <QrScanner
          active
          onClose={() => {
            clearTimer();
            setResult(null);
            setScanning(false);
          }}
          onDecode={(raw) => void submitToken(raw)}
          paused={result !== null}
        />

        {result ? (
          <div className="absolute inset-0 z-10">
            <CheckinResultView
              onDismiss={() => {
                clearTimer();
                setResult(null);
              }}
              onUndo={(id) => void onUndo(id)}
              result={result}
            />
          </div>
        ) : null}

        {/* The event name, so nobody scans a queue into the wrong service. */}
        <p className="pointer-events-none absolute inset-x-0 top-[max(1.4rem,env(safe-area-inset-top))] z-0 truncate px-16 text-center text-[13px] font-medium text-white/90">
          {eventTitle}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <Button
          aria-label="Back to events"
          asChild
          className="-ml-1 shrink-0"
          size="icon"
          variant="ghost"
        >
          <Link href="/events">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {eventTitle}
          </p>
          <p className="text-[13px] text-muted">Check-in</p>
        </div>
        <Button asChild className="hidden shrink-0 sm:inline-flex" size="sm" variant="outline">
          <Link href={`/events/${eventId}/registrations`}>
            <Users />
            Attendance
          </Link>
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile emphasis label="Checked in" value={String(stats.checkedIn)} />
            <StatTile label="Registered" value={String(stats.registered)} />
            <StatTile label="Remaining" value={String(stats.notCheckedIn)} />
            <StatTile label="Attendance" value={`${stats.rate}%`} />
          </div>

          {/*
            The primary action, sized like one. On a phone this is the thing a
            thumb finds without looking.
          */}
          <button
            className="flex w-full flex-col items-center gap-3 rounded-panel border border-border bg-surface px-6 py-10 text-center shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong hover:bg-surface-muted/40"
            onClick={() => setScanning(true)}
            type="button"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <ScanLine className="size-6" />
            </span>
            <span className="text-[17px] font-semibold text-foreground">Scan QR</span>
            <span className="max-w-xs text-[13px] leading-relaxed text-muted">
              Scan an attendee&rsquo;s QR ticket to check them in.
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              or enter manually
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="flex gap-2" onSubmit={onCodeSubmit}>
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoCapitalize="none"
                autoComplete="off"
                className="h-11 pl-9"
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Type or paste a ticket code"
                spellCheck={false}
                value={manualCode}
              />
            </div>
            <Button className="h-11" disabled={!manualCode.trim()} type="submit" variant="outline">
              <QrCode />
              Check in
            </Button>
          </form>

          <ManualCheckin
            busyId={busyId}
            onCheckIn={(id) => void onManualCheckIn(id)}
            onUndo={(id) => void onUndo(id)}
            registrations={rows}
          />

          {recent.length > 0 ? (
            <section className="space-y-2.5">
              <h2 className="text-[13px] font-semibold text-foreground">
                Recent check-ins
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
                {recent.map((row) => (
                  <li
                    className="flex items-center gap-3 px-3.5 py-2.5"
                    key={`recent-${row.id}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check className="size-3.5" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                      {row.attendeeName}
                    </p>
                    <span className="tabular shrink-0 text-[13px] text-muted">
                      {formatTime(row.checkedInAt)}
                    </span>
                    <Button
                      aria-label={`Undo check-in for ${row.attendeeName}`}
                      className="shrink-0"
                      disabled={busyId === row.id}
                      onClick={() => void onUndo(row.id)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <RotateCcw />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </ScrollArea>

      {/* A result from a manual check-in has no camera to sit over. */}
      {result ? (
        <div className="fixed inset-0 z-50 bg-background">
          <CheckinResultView
            onDismiss={() => {
              clearTimer();
              setResult(null);
            }}
            onUndo={(id) => void onUndo(id)}
            result={result}
          />
        </div>
      ) : null}
    </div>
  );
}
