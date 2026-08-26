import { notFound } from "next/navigation";
import { api } from "@/server/trpc/caller";
import { CheckinExperience } from "@/components/checkin/checkin-experience";

export const metadata = { title: "Check-in — Regroup" };

/**
 * The scanning station.
 *
 * Routed inside the dashboard so it inherits the same session and plan gate as
 * every other screen, but rendered WITHOUT the shell — `isImmersiveRoute`
 * matches this path, so the sidebar and top bar step aside and the workflow
 * gets the whole viewport. Nothing here is public: the tRPC procedures it calls
 * re-check ownership and plan on every write, since a POST to the tRPC route
 * handler never renders this layout.
 */
export default async function EventCheckinPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const caller = await api();

  const site = await caller.site.mine();
  if (!site) notFound();

  const events = (await caller.content.listEvents({ siteId: site.id })) ?? [];
  const event = events.find((e) => e.id === eventId);
  if (!event) notFound();

  const [attendance, registrations] = await Promise.all([
    caller.content.eventAttendance({ siteId: site.id, eventId }),
    caller.content.listRegistrations({ siteId: site.id, eventId }),
  ]);

  return (
    <CheckinExperience
      siteId={site.id}
      eventId={eventId}
      eventTitle={event.title}
      initialAttendance={attendance}
      initialRegistrations={registrations ?? []}
    />
  );
}
