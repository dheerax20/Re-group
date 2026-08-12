import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";

export const revalidate = 300;

export default async function SiteHomePage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) notFound();

  const { site, content } = data;

  // navbar/footer are rendered once by the layout; the home page renders
  // every other section in the template's configured order.
  const pageSections = site.sections.filter(
    (s) => s.type !== "navbar" && s.type !== "footer"
  );

  return <WebsiteRenderer site={{ ...site, sections: pageSections }} content={content} />;
}
