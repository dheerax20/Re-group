import Link from "next/link";
import { Mic2, Plus } from "lucide-react";

import { api } from "@/server/trpc/caller";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PAGE_SIZES, Paginate, pageParam, paginate } from "@/components/layout/paginate";
import { FilterSelect, PageToolbar, SearchField } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { SermonsLibrary, type SermonRecord } from "@/components/sermons/sermons-library";

export const metadata = { title: "Sermons — Regroup" };

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Filter options built from the church's own data.
 *
 * A hardcoded list of series would be wrong for every church; these are the
 * distinct values actually in use, so the dropdown is short and never offers a
 * filter that returns nothing.
 */
function distinct(values: Array<string | null>): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (!seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return [...seen.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => ({ value: entry, label: entry }));
}

export default async function SermonsPage({
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
          title="Sermons"
          description="Your message library, published to the sermons page."
        />
        <EmptyState
          action={
            <Button asChild>
              <Link href="/builder">Build my website</Link>
            </Button>
          }
          description="Sermons need somewhere to live. Once your site exists, everything you add here publishes to it."
          icon={Mic2}
          title="Build your website first"
        />
      </>
    );
  }

  const [rows, domains] = await Promise.all([
    trpc.content.listSermons({ siteId: site.id }),
    trpc.domains.list({ siteId: site.id }),
  ]);

  const all = (rows ?? []) as SermonRecord[];
  const query = one(params.q).trim().toLowerCase();
  const series = one(params.series);
  const speaker = one(params.speaker);

  let visible = all;
  if (series) visible = visible.filter((sermon) => sermon.series === series);
  if (speaker) visible = visible.filter((sermon) => sermon.speaker === speaker);
  if (query) {
    visible = visible.filter(
      (sermon) =>
        sermon.title.toLowerCase().includes(query) ||
        (sermon.speaker ?? "").toLowerCase().includes(query) ||
        (sermon.series ?? "").toLowerCase().includes(query)
    );
  }

  const paged = paginate(visible, pageParam(params.page), PAGE_SIZES.cards);
  const siteUrl =
    site.status === "PUBLISHED" ? `https://${domains.canonicalHost}` : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Sermons"
        description="Manage your church's messages and media."
        actions={
          <Button asChild>
            <Link href="/sermons?new=1">
              <Plus />
              Add sermon
            </Link>
          </Button>
        }
      />

      <PageToolbar>
        <SearchField placeholder="Search sermons…" />
        <FilterSelect
          label="All series"
          options={distinct(all.map((sermon) => sermon.series))}
          paramName="series"
        />
        <FilterSelect
          label="All speakers"
          options={distinct(all.map((sermon) => sermon.speaker))}
          paramName="speaker"
        />
      </PageToolbar>

      <div className="space-y-5">
        <SermonsLibrary
          filtered={Boolean(query || series || speaker)}
          sermons={paged.items}
          siteId={site.id}
          siteUrl={siteUrl}
        />

        <Paginate
          basePath="/sermons"
          label="sermons"
          paged={paged}
          searchParams={params}
        />
      </div>
    </>
  );
}
