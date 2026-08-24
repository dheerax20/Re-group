import Link from "next/link";
import Image from "next/image";
import { Search, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedSermons, filterSermons, type CachedSermon } from "@/lib/site/get-site-sermons";
import { headingScaleClass, widthClass } from "@/components/website/blocks/tokens";
import { cn } from "@/lib/utils";

function SermonCard({ sermon }: { sermon: CachedSermon }) {
  return (
    <Link
      href={`/sermons/${sermon.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-site-muted/15 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-site-primary/10">
        {sermon.thumbnailUrl ? (
          <Image
            src={sermon.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 75%, white), var(--color-accent))",
            }}
          />
        )}
        {sermon.videoUrl ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-site-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <Play className="size-5 fill-current" />
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {sermon.series ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-site-accent">
            {sermon.series}
          </p>
        ) : null}
        <h2 className="mt-1.5 text-lg font-semibold leading-snug text-site-foreground group-hover:text-site-accent">
          {sermon.title}
        </h2>
        <p className="mt-auto pt-3 text-sm text-site-muted">
          {sermon.speaker ?? "Guest Speaker"}
          <span aria-hidden="true"> &middot; </span>
          {new Date(sermon.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </Link>
  );
}

export default async function SermonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { siteSlug } = await params;
  const { q } = await searchParams;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) notFound();
  if (!data.site.features.sermons) notFound();

  const { site } = data;

  const allSermons = await getCachedSermons(site.site.id, siteSlug);
  const sermons = filterSermons(allSermons, q);

  return (
    <div className={cn(widthClass.wide, "py-20")}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-site-accent">
            Messages
          </p>
          <h1 className={cn(headingScaleClass.h1, "mt-2 text-site-foreground")}>Sermons</h1>
        </div>

        {site.features.sermonSearch ? (
          <form action="" className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-site-muted" />
            <input
              type="search"
              name="q"
              placeholder="Search title, speaker, series"
              defaultValue={q ?? ""}
              className="w-full rounded-full border border-site-muted/25 bg-site-background py-2.5 pl-10 pr-4 text-sm text-site-foreground outline-none placeholder:text-site-muted focus-visible:border-site-accent"
            />
          </form>
        ) : null}
      </div>

      {sermons.length === 0 ? (
        <p className="mt-16 text-lg text-site-muted">
          {q ? "No sermons match your search." : "No sermons have been added yet."}
        </p>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {sermons.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} />
          ))}
        </div>
      )}
    </div>
  );
}
