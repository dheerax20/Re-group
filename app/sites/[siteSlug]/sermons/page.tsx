import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { Input } from "@/components/ui/input";

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

  const sermons = await prisma.sermon.findMany({
    where: {
      siteId: site.site.id,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { speaker: { contains: q, mode: "insensitive" } },
              { series: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-site-foreground">Sermons</h1>

      {site.features.sermonSearch && (
        <form className="mt-6" action="">
          <Input
            type="search"
            name="q"
            placeholder="Search by title, speaker, or series"
            defaultValue={q ?? ""}
          />
        </form>
      )}

      {sermons.length === 0 ? (
        <p className="mt-8 text-site-muted">
          {q ? "No sermons match your search." : "No sermons have been added yet."}
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-site-muted/15">
          {sermons.map((sermon) => (
            <li key={sermon.id} className="py-5">
              <Link href={`/sermons/${sermon.slug}`} className="hover:text-site-accent">
                <h2 className="text-lg font-semibold">{sermon.title}</h2>
              </Link>
              <p className="mt-1 text-sm text-site-muted">
                {sermon.speaker ?? "Guest Speaker"} &middot;{" "}
                {sermon.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {sermon.series ? ` · ${sermon.series}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
