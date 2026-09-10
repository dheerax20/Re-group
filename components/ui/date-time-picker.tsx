"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A date button and a time field, over one `datetime-local` string.
 *
 * Derived from `@ss-components/date-picker-12`, which pairs a calendar popover
 * with a time input. That component is an uncontrolled demo with hardcoded
 * dates; this is the controlled version the event form needs.
 *
 * The value stays in the exact `YYYY-MM-DDTHH:mm` shape a native
 * `<input type="datetime-local">` produces, so nothing downstream moves:
 * `EventFormValues` still holds strings, `toDatetimeLocal` still seeds them
 * from a `Date`, and `eventInputSchema` still parses them with `new Date()`.
 */

/** What the time field falls back to when a date is picked before a time. */
const DEFAULT_TIME = "09:00";

/** Splits a `datetime-local` string. Tolerates "" and a date with no time. */
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

/**
 * The local calendar day a `YYYY-MM-DD` string names.
 *
 * Built from the parts rather than `new Date(value)` on purpose: a bare
 * `new Date("2026-09-01")` is parsed as UTC midnight, which is the previous
 * day for every reader west of Greenwich — so the calendar would highlight the
 * 31st for an event on the 1st.
 */
export function parseLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The inverse: a local `Date` plus `HH:mm` back into the stored string. */
export function toDateTimeLocal(date: Date | undefined, time: string): string {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${time || DEFAULT_TIME}`;
}

const LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  /** Goes on the trigger, so the `<Label htmlFor>` beside it still works. */
  id: string;
  /** `YYYY-MM-DDTHH:mm`, or "" for no value. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { date: datePart, time: timePart } = splitDateTimeLocal(value);
  const selected = parseLocalDate(datePart);

  /**
   * The time is held locally as well as derived, so it can be set BEFORE a
   * date exists. Without this, typing a time into an empty field would have
   * nowhere to go — `toDateTimeLocal` returns "" with no date — and the
   * keystroke would vanish.
   */
  const [time, setTime] = useState(timePart);
  const effectiveTime = timePart || time;

  function pickDate(next: Date | undefined) {
    const nextTime = effectiveTime || DEFAULT_TIME;
    setTime(nextTime);
    onChange(toDateTimeLocal(next, nextTime));
    setOpen(false);
  }

  function pickTime(next: string) {
    setTime(next);
    if (selected) onChange(toDateTimeLocal(selected, next));
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className="w-full flex-1 justify-start font-normal"
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          >
            <CalendarIcon className="text-muted" />
            {selected ? (
              selected.toLocaleDateString("en-US", LABEL_FORMAT)
            ) : (
              <span className="text-muted">Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            /**
             * A church booking a carol service in March should not click
             * through nine months to get there.
             */
            captionLayout="dropdown"
            mode="single"
            onSelect={pickDate}
            selected={selected}
          />
          {value ? (
            <div className="border-t border-border p-2">
              <Button
                className="w-full"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <Label className="sr-only" htmlFor={`${id}-time`}>
        Time
      </Label>
      <Input
        // No `step`: seconds are noise on a church event.
        className="w-[7.5rem] shrink-0"
        disabled={disabled}
        id={`${id}-time`}
        onChange={(event) => pickTime(event.target.value)}
        type="time"
        value={effectiveTime}
      />
    </div>
  );
}
