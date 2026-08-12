import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const { siteSlug, slug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.sermons) notFound();

  const sermon = await prisma.sermon.findUnique({
    where: { siteId_slug: { siteId: data.site.site.id, slug } },
  });
  if (!sermon) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {sermon.series && (
        <p className="text-sm font-semibold uppercase tracking-wide text-site-accent">
          {sermon.series}
        </p>
      )}
      <h1 className="mt-2 text-3xl font-bold text-site-foreground">{sermon.title}</h1>
      <p className="mt-2 text-sm text-site-muted">
        {sermon.speaker ?? "Guest Speaker"} &middot;{" "}
        {sermon.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      {sermon.videoUrl && (
        <div className="mt-8 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={sermon.videoUrl.replace("watch?v=", "embed/")}
            className="h-full w-full"
            allowFullScreen
            title={sermon.title}
          />
        </div>
      )}

      {sermon.audioUrl && (
        <audio controls className="mt-6 w-full">
          <source src={sermon.audioUrl} />
        </audio>
      )}

      {sermon.description && <p className="mt-8 text-site-muted">{sermon.description}</p>}

      {sermon.transcript && (
        <details className="mt-8">
          <summary className="cursor-pointer font-medium text-site-foreground">
            Transcript
          </summary>
          <p className="mt-4 whitespace-pre-line text-sm text-site-muted">
            {sermon.transcript}
          </p>
        </details>
      )}
    </article>
  );
}
