import { describe, expect, it } from "vitest";
import {
  parseLocalDate,
  splitDateTimeLocal,
  toDateTimeLocal,
} from "@/components/ui/date-time-picker";

/**
 * The picker's string <-> Date conversion, which is where the real bugs are.
 *
 * The component itself is not exercised: vitest runs `environment: "node"`,
 * so there is no DOM to open a popover in. What matters is that the stored
 * value keeps the exact `datetime-local` shape the event form and
 * `eventInputSchema` already agree on, and that a date never moves a day.
 */
describe("splitDateTimeLocal", () => {
  it("splits a stored value", () => {
    expect(splitDateTimeLocal("2026-09-01T10:30")).toEqual({
      date: "2026-09-01",
      time: "10:30",
    });
  });

  it("returns empty parts for an unset field", () => {
    // Ends and the registration deadline are both optional and start blank.
    expect(splitDateTimeLocal("")).toEqual({ date: "", time: "" });
  });

  it("drops seconds a browser may have appended", () => {
    expect(splitDateTimeLocal("2026-09-01T10:30:00").time).toBe("10:30");
  });
});

describe("parseLocalDate", () => {
  /**
   * The whole reason this function exists. `new Date("2026-09-01")` is parsed
   * as UTC midnight, which is 31 August for every reader west of Greenwich —
   * so the calendar would highlight the wrong day for an event on the 1st.
   */
  it("reads a date as a LOCAL calendar day, not UTC midnight", () => {
    const date = parseLocalDate("2026-09-01")!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
  });

  it("refuses anything that is not a plain date", () => {
    expect(parseLocalDate("")).toBeUndefined();
    expect(parseLocalDate("2026-09")).toBeUndefined();
    expect(parseLocalDate("tomorrow")).toBeUndefined();
  });
});

describe("toDateTimeLocal", () => {
  it("round-trips a stored value unchanged", () => {
    const value = "2026-09-01T10:30";
    const { date, time } = splitDateTimeLocal(value);
    expect(toDateTimeLocal(parseLocalDate(date), time)).toBe(value);
  });

  it("pads single-digit months, days and stays in local time", () => {
    expect(toDateTimeLocal(new Date(2026, 0, 5), "07:05")).toBe("2026-01-05T07:05");
  });

  it("falls back to a service-hour time when a date is picked first", () => {
    expect(toDateTimeLocal(new Date(2026, 0, 5), "")).toBe("2026-01-05T09:00");
  });

  it("stays empty with no date, so a cleared field clears completely", () => {
    expect(toDateTimeLocal(undefined, "10:30")).toBe("");
  });
});
