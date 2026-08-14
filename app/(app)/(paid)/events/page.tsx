import Link from "next/link";
import { resolveActiveSite } from "@/lib/site/actions";
import { listEvents } from "@/lib/site/content-actions";
import { EventsManager } from "@/components/builder/events-manager";
import { Button } from "@/components/ui/button";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: preferred } = await searchParams;
  const site = await resolveActiveSite(preferred ?? null);

  if (!site) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="mt-2 text-sm text-muted">
          Create a church website first — then events you add here show on the public site.
        </p>
        <Link href="/builder" className="mt-6 inline-block">
          <Button>Create website</Button>
        </Link>
      </div>
    );
  }

  const events = (await listEvents(site.id)) ?? [];
  return <EventsManager siteId={site.id} events={events} />;
}
