"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Search, Users } from "lucide-react";

import type { RegistrationRow } from "@/lib/trpc/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Finding someone by name.
 *
 * The QR path fails often enough that this cannot be a setting buried behind
 * it: a cracked screen, a dead battery, an attendee who never opened the email,
 * a walk-up. So it is a peer of scanning, and it is fast — type three letters,
 * tap the green button, done.
 *
 * The list is capped rather than paginated. Nobody scrolls to attendee 40 in a
 * foyer; they type another letter. Showing a count instead of a page control
 * keeps one thumb-sized target per row.
 */
export function ManualCheckin({
  registrations,
  busyId,
  onCheckIn,
  onUndo,
  className,
}: {
  registrations: RegistrationRow[];
  busyId?: string | null;
  onCheckIn: (registrationId: string) => void;
  onUndo: (registrationId: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const { rows, hidden } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? registrations.filter(
          (row) =>
            row.attendeeName.toLowerCase().includes(needle) ||
            row.attendeeEmail.toLowerCase().includes(needle) ||
            (row.attendeePhone ?? "").toLowerCase().includes(needle)
        )
      : registrations;

    // Not-yet-arrived first: at a door, the people you are looking for are the
    // ones who have not been checked in.
    const sorted = [...matched].sort((a, b) => {
      const aIn = a.checkedInAt ? 1 : 0;
      const bIn = b.checkedInAt ? 1 : 0;
      if (aIn !== bIn) return aIn - bIn;
      return a.attendeeName.localeCompare(b.attendeeName);
    });

    return { rows: sorted.slice(0, 25), hidden: Math.max(0, sorted.length - 25) };
  }, [registrations, query]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          aria-label="Search attendees"
          autoComplete="off"
          className="h-11 pl-9 text-[15px]"
          inputMode="search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, or phone"
          value={query}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-panel border border-dashed border-border-strong px-5 py-10 text-center">
          <Users className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-[13px] text-muted">
            {registrations.length === 0
              ? "Nobody has registered for this event yet."
              : "No attendee matches that search."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
          {rows.map((row) => {
            const checkedIn = Boolean(row.checkedInAt);
            return (
              <li className="flex items-center gap-3 px-3.5 py-3" key={row.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {row.attendeeName}
                    </p>
                    {row.guestCount > 0 ? (
                      <span className="text-[13px] text-muted">+{row.guestCount}</span>
                    ) : null}
                    {row.status !== "CONFIRMED" ? (
                      <Badge
                        variant={row.status === "WAITLISTED" ? "warning" : "secondary"}
                      >
                        {row.status === "WAITLISTED" ? "Waitlist" : "Cancelled"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {checkedIn
                      ? `Checked in ${formatTime(row.checkedInAt)}${
                          row.checkedInVia === "MANUAL" ? " · manual" : ""
                        }`
                      : row.attendeeEmail}
                  </p>
                </div>

                {checkedIn ? (
                  <Button
                    className="shrink-0"
                    disabled={busyId === row.id}
                    onClick={() => onUndo(row.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <RotateCcw />
                    Undo
                  </Button>
                ) : (
                  <Button
                    className="h-10 shrink-0 px-4"
                    disabled={busyId === row.id || row.status === "CANCELLED"}
                    onClick={() => onCheckIn(row.id)}
                    size="sm"
                  >
                    <Check />
                    Check in
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 ? (
        <p className="text-center text-[13px] text-muted">
          {hidden} more — keep typing to narrow the list.
        </p>
      ) : null}
    </div>
  );
}
