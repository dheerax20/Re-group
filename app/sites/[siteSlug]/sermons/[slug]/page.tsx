import Link from "next/link";
import { ArrowLeft, Calendar, Mic2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getCachedSermons, findSermonBySlug } from "@/lib/site/get-site-sermons";
import { headingScaleClass } from "@/components/website/blocks/tokens";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const { siteSlug, slug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.sermons) notFound();

  const allSermons = await getCachedSermons(data.site.site.id, siteSlug);
  const sermon = findSermonBySlug(allSermons, slug);
  if (!sermon) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Link
        href="/sermons"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-site-muted hover:text-site-accent"
      >
        <ArrowLeft className="size-4" />
        All sermons
      </Link>

      <div className="mt-8">
        {sermon.series ? (
          <p className="text-sm font-semibold uppercase tracking-wide text-site-accent">
            {sermon.series}
          </p>
        ) : null}
        <h1 className={cn(headingScaleClass.h1, "mt-2 text-site-foreground")}>{sermon.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-site-muted">
          <span className="inline-flex items-center gap-1.5">
            <Mic2 className="size-4" />
            {sermon.speaker ?? "Guest Speaker"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4" />
            {new Date(sermon.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {sermon.videoUrl ? (
        <div className="mt-10 aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
          <iframe
            src={sermon.videoUrl.replace("watch?v=", "embed/")}
            className="h-full w-full"
            allowFullScreen
            title={sermon.title}
          />
        </div>
      ) : null}

      {sermon.audioUrl ? (
        <div className="mt-8 rounded-2xl border border-site-muted/15 p-4">
          <audio controls className="w-full">
            <source src={sermon.audioUrl} />
          </audio>
        </div>
      ) : null}

      {sermon.description ? (
        <p className="mt-10 text-lg leading-relaxed text-site-muted">{sermon.description}</p>
      ) : null}

      {sermon.transcript ? (
        <details className="group mt-10 rounded-2xl border border-site-muted/15 p-5">
          <summary className="cursor-pointer text-lg font-medium text-site-foreground marker:content-none">
            Transcript
          </summary>
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-site-muted">
            {sermon.transcript}
          </p>
        </details>
      ) : null}
    </article>
  );
}
