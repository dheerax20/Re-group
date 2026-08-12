import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { ContactStandard } from "@/components/website/sections/contact";

export const revalidate = 300;

export default async function ContactPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.contact) notFound();

  return <ContactStandard site={data.site} config={{}} content={data.content} />;
}
