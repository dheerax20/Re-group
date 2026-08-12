import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { listEvents } from "@/lib/site/content-actions";
import { EventsManager } from "@/components/builder/events-manager";

export default async function BuilderEventsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  const events = (await listEvents(siteId)) ?? [];

  return <EventsManager siteId={siteId} events={events} />;
}
