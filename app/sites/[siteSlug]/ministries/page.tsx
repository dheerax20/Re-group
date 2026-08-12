import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { MinistryGrid } from "@/components/website/sections/ministries";

export const revalidate = 300;

export default async function MinistriesPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.ministries) notFound();

  return <MinistryGrid site={data.site} config={{}} content={data.content} />;
}
