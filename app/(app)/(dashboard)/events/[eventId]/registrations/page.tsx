import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";

import { api } from "@/server/trpc/caller";
import { PageHeader } from "@/components/layout/page-header";
import { FilterSelect, PageToolbar, SearchField } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { AttendanceView } from "@/components/attendance/attendance-view";
import { ExportButton } from "@/components/attendance/export-button";

export const metadata = { title: "Attendance — Regroup" };

const STATUS_OPTIONS = [
  { value: "checked_in", label: "Checked in" },
  { value: "not_arrived", label: "Not arrived" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "WAITLISTED", label: "Waitlisted" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * Attendance for one event.
 *
 * Reads as a report: who registered, who arrived, and when. The check-in
 * *workflow* lives on its own immersive screen — this is where a church looks
 * afterwards, or from a desk while someone else works the door.
 */
export default async function EventAttendancePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const trpc = await api();

  const site = await trpc.site.mine();
  if (!site) notFound();

  const events = (await trpc.content.listEvents({ siteId: site.id })) ?? [];
  const event = events.find((row) => row.id === eventId);
  if (!event) notFound();

  const registrations =
    (await trpc.content.listRegistrations({ siteId: site.id, eventId })) ?? [];

  const expected = registrations
    .filter((row) => row.status === "CONFIRMED")
    .reduce((sum, row) => sum + 1 + row.guestCount, 0);

  return (
    <>
      <Button asChild className="-ml-2 mb-2" size="sm" variant="ghost">
        <Link href="/events">
          <ArrowLeft />
          Events
        </Link>
      </Button>

      <PageHeader
        eyebrow={event.title}
        title="Attendance"
        description={`${expected} expected${
          event.capacity ? ` of ${event.capacity} capacity` : ""
        } · registrations and check-ins for this event.`}
        actions={
          event.rsvpEnabled ? (
            <Button asChild>
              <Link href={`/events/${eventId}/checkin`}>
                <QrCode />
                Start check-in
              </Link>
            </Button>
          ) : null
        }
      />

      <PageToolbar
        actions={
          <ExportButton
            eventId={eventId}
            filename={`${event.slug || "event"}-attendance.csv`}
            siteId={site.id}
          />
        }
      >
        <SearchField placeholder="Search attendees…" />
        <FilterSelect label="All attendees" options={STATUS_OPTIONS} paramName="status" />
      </PageToolbar>

      <AttendanceView
        eventId={eventId}
        registrations={registrations}
        siteId={site.id}
      />
    </>
  );
}
