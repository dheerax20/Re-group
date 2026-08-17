import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { resolveActiveSite } from "@/lib/site/actions";
import { listEvents } from "@/lib/site/content-actions";
import { EventsManager } from "@/components/builder/events-manager";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Events — Regroup" };

export default async function EventsPage() {
  const site = await resolveActiveSite();

  if (!site) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Events"
          description="Gatherings you add here appear on your public calendar."
        />
        <EmptyState
          icon={CalendarPlus}
          title="Build your website first"
          description="Events need somewhere to live. Once your site exists, everything you add here publishes to it."
          action={
            <Link href="/builder">
              <Button>Build my website</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const events = (await listEvents(site.id)) ?? [];
  return <EventsManager siteId={site.id} events={events} />;
}
