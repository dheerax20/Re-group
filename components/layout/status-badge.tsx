import { Badge } from "@/components/ui/badge";

/**
 * Every status label in the product, in one table.
 *
 * The database enums are shouty (`REGISTRATION_CLOSED`) and were being printed
 * raw in places, which is a schema leaking onto a church's screen. This maps
 * each one to sentence case and to a tone, so "Published" is the same green in
 * the events grid, the attendance table and the check-in list.
 */

type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_CLOSED"
  | "COMPLETED"
  | "CANCELLED";

type RegistrationStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED";

type Tone = "success" | "warning" | "secondary" | "destructive" | "info";

const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "secondary" },
  PUBLISHED: { label: "Published", tone: "success" },
  REGISTRATION_CLOSED: { label: "Registration closed", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "destructive" },
};

const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  CONFIRMED: { label: "Confirmed", tone: "success" },
  WAITLISTED: { label: "Waitlisted", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "secondary" },
};

export const EVENT_STATUS_OPTIONS = (
  Object.keys(EVENT_STATUS) as EventStatus[]
).map((value) => ({ value, label: EVENT_STATUS[value].label }));

export function eventStatusLabel(status: EventStatus): string {
  return EVENT_STATUS[status].label;
}

export function StatusBadge({
  status,
  kind = "event",
  dot = true,
}: {
  status: string;
  kind?: "event" | "registration";
  dot?: boolean;
}) {
  const table = kind === "event" ? EVENT_STATUS : REGISTRATION_STATUS;
  const entry = (table as Record<string, { label: string; tone: Tone }>)[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase(),
    tone: "secondary" as Tone,
  };

  return (
    <Badge dot={dot} variant={entry.tone}>
      {entry.label}
    </Badge>
  );
}

/** Check-in state reads as its own thing, not as a registration status. */
export function CheckedInBadge({ checkedIn }: { checkedIn: boolean }) {
  return (
    <Badge dot variant={checkedIn ? "success" : "secondary"}>
      {checkedIn ? "Checked in" : "Not arrived"}
    </Badge>
  );
}
