import { prisma } from "@/lib/db";
import { toDatabaseError } from "@/lib/db/errors";

/**
 * Event attendance: turning a QR ticket (or a volunteer's tap) into a
 * `Registration.checkedInAt`.
 *
 * Every function here takes a `siteId` and filters on it, even when the token
 * or registration id alone would be unique. The id is never the authorisation —
 * it comes off a camera or a URL, and one church's volunteer scanning another
 * church's ticket has to read as "not found", not as a successful check-in
 * against someone else's event.
 */

export type CheckInMethod = "QR" | "MANUAL";

export type CheckedInRegistration = {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  guestCount: number;
  status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  checkedInAt: Date | null;
  checkedInVia: CheckInMethod | null;
  eventId: string;
  eventTitle: string;
};

export type CheckInResult =
  | {
      ok: true;
      /** `already` still returns the registration — the desk needs the first time. */
      outcome: "checked_in" | "already";
      registration: CheckedInRegistration;
    }
  | {
      ok: false;
      reason: "not_found" | "wrong_event" | "cancelled";
      message: string;
      /** Present for `wrong_event` / `cancelled`, so the screen can name the person. */
      registration?: CheckedInRegistration;
    };

/**
 * Pulls the token out of whatever the camera produced.
 *
 * The QR encodes a full check-in URL (`https://grace.regroup.app/checkin/<token>`)
 * so a phone's native camera app has somewhere to go, but a scan can also
 * arrive as a bare token — from a hardware scanner acting as a keyboard, or
 * from a volunteer typing the code off a printed ticket. Both are accepted;
 * anything else returns null rather than being sent to the database as a lookup
 * that cannot match.
 */
export function extractQrToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromUrl = /\/checkin\/([A-Za-z0-9_-]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];

  // A bare token: base64url out of `crypto.randomBytes(24)`.
  if (/^[A-Za-z0-9_-]{16,128}$/.test(trimmed)) return trimmed;

  return null;
}

const SELECT = {
  id: true,
  attendeeName: true,
  attendeeEmail: true,
  guestCount: true,
  status: true,
  checkedInAt: true,
  checkedInVia: true,
  eventId: true,
  event: { select: { title: true } },
} as const;

type Row = {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  guestCount: number;
  status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  checkedInAt: Date | null;
  checkedInVia: CheckInMethod | null;
  eventId: string;
  event: { title: string };
};

function shape(row: Row): CheckedInRegistration {
  return {
    id: row.id,
    attendeeName: row.attendeeName,
    attendeeEmail: row.attendeeEmail,
    guestCount: row.guestCount,
    status: row.status,
    checkedInAt: row.checkedInAt,
    checkedInVia: row.checkedInVia,
    eventId: row.eventId,
    eventTitle: row.event.title,
  };
}

/**
 * The shared tail of both check-in paths.
 *
 * The write is conditional on `checkedInAt: null` inside `updateMany`, which is
 * what makes a double scan safe: two volunteers pointing phones at the same
 * ticket produce one stamped time and one "already checked in", instead of the
 * second silently overwriting the first arrival time.
 */
async function stamp(
  row: Row,
  method: CheckInMethod,
  actorEmail: string | null
): Promise<CheckInResult> {
  if (row.status === "CANCELLED") {
    return {
      ok: false,
      reason: "cancelled",
      message: `${row.attendeeName} cancelled this registration.`,
      registration: shape(row),
    };
  }

  if (row.checkedInAt) {
    return { ok: true, outcome: "already", registration: shape(row) };
  }

  const checkedInAt = new Date();
  const { count } = await prisma.registration.updateMany({
    where: { id: row.id, checkedInAt: null },
    data: { checkedInAt, checkedInBy: actorEmail, checkedInVia: method },
  });

  if (count === 0) {
    // Lost the race to a simultaneous scan — re-read so the desk sees the time
    // that actually stuck.
    const fresh = await prisma.registration.findUnique({
      where: { id: row.id },
      select: SELECT,
    });
    return { ok: true, outcome: "already", registration: shape((fresh ?? row) as Row) };
  }

  return {
    ok: true,
    outcome: "checked_in",
    registration: { ...shape(row), checkedInAt, checkedInVia: method },
  };
}

/**
 * Scan path. `eventId` is optional: passing it means "this station is running
 * one event", and a valid ticket for a *different* event is then rejected
 * loudly rather than quietly checked in at the wrong door.
 */
export async function checkInByToken(
  siteId: string,
  rawScan: string,
  options: { eventId?: string; actorEmail?: string | null } = {}
): Promise<CheckInResult> {
  const qrToken = extractQrToken(rawScan);
  if (!qrToken) {
    return { ok: false, reason: "not_found", message: "That code isn't a Regroup ticket." };
  }

  try {
    const row = await prisma.registration.findFirst({
      where: { qrToken, siteId },
      select: SELECT,
    });

    if (!row) {
      return { ok: false, reason: "not_found", message: "No registration matches that ticket." };
    }

    if (options.eventId && row.eventId !== options.eventId) {
      return {
        ok: false,
        reason: "wrong_event",
        message: `This ticket is for ${row.event.title}.`,
        registration: shape(row as Row),
      };
    }

    return await stamp(row as Row, "QR", options.actorEmail ?? null);
  } catch (error) {
    toDatabaseError(error);
  }
}

/**
 * Manual path — the fallback for a cracked phone screen, a printed ticket that
 * will not focus, or an attendee who never opened the email. Same write, same
 * idempotency; only `checkedInVia` differs, so attendance totals do not care
 * which way someone came through the door.
 */
export async function checkInByRegistrationId(
  siteId: string,
  registrationId: string,
  options: { actorEmail?: string | null } = {}
): Promise<CheckInResult> {
  try {
    const row = await prisma.registration.findFirst({
      where: { id: registrationId, siteId },
      select: SELECT,
    });

    if (!row) {
      return { ok: false, reason: "not_found", message: "That registration no longer exists." };
    }

    return await stamp(row as Row, "MANUAL", options.actorEmail ?? null);
  } catch (error) {
    toDatabaseError(error);
  }
}

/** Undo a mistaken check-in. Clears the actor and method with the timestamp. */
export async function undoCheckIn(
  siteId: string,
  registrationId: string
): Promise<CheckInResult> {
  try {
    const { count } = await prisma.registration.updateMany({
      where: { id: registrationId, siteId },
      data: { checkedInAt: null, checkedInBy: null, checkedInVia: null },
    });

    if (count === 0) {
      return { ok: false, reason: "not_found", message: "That registration no longer exists." };
    }

    const row = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: SELECT,
    });

    if (!row) {
      return { ok: false, reason: "not_found", message: "That registration no longer exists." };
    }

    return { ok: true, outcome: "checked_in", registration: shape(row as Row) };
  } catch (error) {
    toDatabaseError(error);
  }
}

export type EventAttendance = {
  registered: number;
  /** Head count including guests, which is what actually fills the room. */
  expected: number;
  checkedIn: number;
  notCheckedIn: number;
  /** 0–100, rounded to one decimal. */
  rate: number;
};

/**
 * The live counters above the scanner.
 *
 * Waitlisted and cancelled registrations are excluded from the denominator: a
 * church measuring "did the people we confirmed turn up" is not helped by a
 * rate diluted with people who were never given a seat. A waitlisted attendee
 * let in at the door still counts in `checkedIn` — the numerator is simply
 * "who walked through".
 */
export async function getEventAttendance(
  siteId: string,
  eventId: string
): Promise<EventAttendance> {
  try {
    const rows = await prisma.registration.findMany({
      where: { siteId, eventId },
      select: { status: true, guestCount: true, checkedInAt: true },
    });

    const confirmed = rows.filter((r) => r.status === "CONFIRMED");
    const registered = confirmed.length;
    const expected = confirmed.reduce((sum, r) => sum + 1 + r.guestCount, 0);
    const checkedIn = rows.filter((r) => r.checkedInAt !== null).length;
    const notCheckedIn = Math.max(registered - checkedIn, 0);

    return {
      registered,
      expected,
      checkedIn,
      notCheckedIn,
      rate: registered === 0 ? 0 : Math.round((checkedIn / registered) * 1000) / 10,
    };
  } catch (error) {
    toDatabaseError(error);
  }
}

/**
 * The read behind the public ticket page — a token-holder looking at their own
 * QR. Returns only what already appears on the ticket in their inbox, and
 * never checks anyone in: arrival is a decision the door makes, not something
 * an attendee can grant themselves by opening a link.
 */
export async function getTicketByToken(siteSlug: string, qrToken: string) {
  try {
    const row = await prisma.registration.findFirst({
      where: { qrToken, site: { slug: siteSlug } },
      select: {
        id: true,
        attendeeName: true,
        guestCount: true,
        status: true,
        checkedInAt: true,
        event: {
          select: { title: true, startAt: true, endAt: true, location: true, address: true },
        },
      },
    });
    return row;
  } catch (error) {
    toDatabaseError(error);
  }
}
