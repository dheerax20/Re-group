import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { GivingCentered } from "@/components/website/sections/giving";

export const revalidate = 300;

export default async function GivingPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.giving) notFound();

  return <GivingCentered site={data.site} config={{}} content={data.content} />;
}
