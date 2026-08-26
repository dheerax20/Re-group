import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";

import { api } from "@/server/trpc/caller";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PAGE_SIZES, Paginate, pageParam, paginate } from "@/components/layout/paginate";
import {
  FilterSelect,
  PageToolbar,
  SearchField,
  SegmentedFilter,
} from "@/components/layout/page-toolbar";
import { EVENT_STATUS_OPTIONS } from "@/components/layout/status-badge";
import { Button } from "@/components/ui/button";
import { EventsLibrary, type EventRecord } from "@/components/events/events-library";

export const metadata = { title: "Events — Regroup" };

const WHEN_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Split by "has it happened yet", read at module scope.
 *
 * Reading the clock during render is impure; doing it here also means the two
 * halves are sorted the way each is actually read — what's next first for
 * upcoming, most recent first for past.
 */
function partition<T extends { startAt: Date; endAt: Date | null }>(events: T[]) {
  const now = Date.now();
  const isPast = (event: T) => (event.endAt ?? event.startAt).getTime() < now;
  return {
    upcoming: events
      .filter((event) => !isPast(event))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    past: events
      .filter(isPast)
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime()),
  };
}

/**
 * The events library.
 *
 * All the filtering happens here, on the server, against the real list — the
 * browser receives one page of twelve cards rather than every event a church
 * has ever run plus the code to sift them.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const trpc = await api();
  const site = await trpc.site.mine();

  if (!site) {
    return (
      <>
        <PageHeader
          eyebrow="Content"
          title="Events"
          description="Gatherings you add here appear on your public calendar."
        />
        <EmptyState
          action={
            <Button asChild>
              <Link href="/builder">Build my website</Link>
            </Button>
          }
          description="Events need somewhere to live. Once your site exists, everything you add here publishes to it."
          icon={CalendarPlus}
          title="Build your website first"
        />
      </>
    );
  }

  const [rows, domains] = await Promise.all([
    trpc.content.listEvents({ siteId: site.id }),
    trpc.domains.list({ siteId: site.id }),
  ]);

  const query = one(params.q).trim().toLowerCase();
  const status = one(params.status);
  const when = one(params.when) || "upcoming";

  const all = (rows ?? []) as EventRecord[];
  const { upcoming, past } = partition(all);

  let visible = when === "past" ? past : upcoming;
  if (status) visible = visible.filter((event) => event.status === status);
  if (query) {
    visible = visible.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        (event.location ?? "").toLowerCase().includes(query) ||
        (event.category ?? "").toLowerCase().includes(query)
    );
  }

  const paged = paginate(visible, pageParam(params.page), PAGE_SIZES.cards);
  const siteUrl =
    site.status === "PUBLISHED" ? `https://${domains.canonicalHost}` : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Events"
        description="Create and manage events for your church."
        actions={
          <Button asChild>
            <Link href="/events?new=1">
              <Plus />
              Create event
            </Link>
          </Button>
        }
      />

      <PageToolbar>
        <SearchField placeholder="Search events…" />
        <SegmentedFilter options={WHEN_OPTIONS} paramName="when" />
        <FilterSelect
          label="All statuses"
          options={EVENT_STATUS_OPTIONS}
          paramName="status"
        />
      </PageToolbar>

      <div className="space-y-5">
        <EventsLibrary
          events={paged.items}
          filtered={Boolean(query || status)}
          siteId={site.id}
          siteUrl={siteUrl}
        />

        <Paginate
          basePath="/events"
          label="events"
          paged={paged}
          searchParams={params}
        />
      </div>
    </>
  );
}
