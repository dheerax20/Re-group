import { notFound } from "next/navigation";
import { api } from "@/server/trpc/caller";
import { PageHeader } from "@/components/layout/page-header";
import { RegistrationsTable } from "@/components/builder/registrations-table";

export const metadata = { title: "Registrations — Regroup" };

export default async function EventRegistrationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const site = await (await api()).site.mine();
  if (!site) notFound();

  const events = (await (await api()).content.listEvents({ siteId: site.id })) ?? [];
  const event = events.find((e) => e.id === eventId);
  if (!event) notFound();

  const registrations =
    (await (await api()).content.listRegistrations({ siteId: site.id, eventId })) ?? [];

  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");
  const attending = confirmed.reduce((sum, r) => sum + 1 + r.guestCount, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={event.title}
        description={`${attending} registered${event.capacity ? ` of ${event.capacity} capacity` : ""}`}
      />
      <RegistrationsTable siteId={site.id} eventId={eventId} registrations={registrations} />
    </div>
  );
}
