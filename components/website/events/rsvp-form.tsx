"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type EventInfo = {
  id: string;
  title: string;
  startAt: string;
  location: string | null;
  allowGuests: boolean;
};

type RsvpSuccess = {
  registration: { id: string; status: "CONFIRMED" | "WAITLISTED" };
  qrDataUrl: string;
};

const inputClass =
  "w-full rounded-lg border border-site-muted/25 bg-site-background px-3 py-2 text-sm text-site-foreground outline-none placeholder:text-site-muted focus-visible:border-site-accent";

function toIcs(event: EventInfo, registrationId: string): string {
  const start = new Date(event.startAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${registrationId}@regroup.app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${event.title}`,
    event.location ? `LOCATION:${event.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function addToCalendar(event: EventInfo, registrationId: string) {
  const ics = toIcs(event, registrationId);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RsvpForm({ event }: { event: EventInfo }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RsvpSuccess | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          guestCount: event.allowGuests ? Number(guestCount) : 0,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message ?? "Could not complete your RSVP.");
        return;
      }
      setResult({ registration: body.registration, qrDataUrl: body.qrDataUrl });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const isWaitlisted = result.registration.status === "WAITLISTED";
    return (
      <div className="rounded-2xl border border-site-muted/20 bg-site-primary/5 p-6">
        <h3 className="text-lg font-semibold text-site-foreground">
          {isWaitlisted ? "You're on the waitlist" : "You're registered!"}
        </h3>
        <dl className="mt-4 space-y-1 text-sm text-site-muted">
          <div className="flex gap-2">
            <dt className="font-medium text-site-foreground">Name</dt>
            <dd>{name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-site-foreground">Event</dt>
            <dd>{event.title}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-site-foreground">Registration ID</dt>
            <dd>{result.registration.id}</dd>
          </div>
        </dl>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.qrDataUrl}
          alt="Check-in QR code"
          width={180}
          height={180}
          className="mt-4 rounded-lg border border-site-muted/20"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="site"
            onClick={() => addToCalendar(event, result.registration.id)}
          >
            Add to Calendar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-site-muted/20 p-6">
      <div>
        <label htmlFor="rsvp-name" className="mb-1 block text-sm font-medium text-site-foreground">
          Full name
        </label>
        <input
          id="rsvp-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="rsvp-email" className="mb-1 block text-sm font-medium text-site-foreground">
          Email
        </label>
        <input
          id="rsvp-email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="rsvp-phone" className="mb-1 block text-sm font-medium text-site-foreground">
          Phone (optional)
        </label>
        <input
          id="rsvp-phone"
          type="tel"
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {event.allowGuests ? (
        <div>
          <label htmlFor="rsvp-guests" className="mb-1 block text-sm font-medium text-site-foreground">
            Number of guests
          </label>
          <input
            id="rsvp-guests"
            type="number"
            min={0}
            max={20}
            className={inputClass}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" variant="site" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Submitting..." : "RSVP Now"}
      </Button>
    </form>
  );
}
