import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import type { BlockNode } from "@/lib/site/blocks/types";

export const revalidate = 300;

export default async function MinistriesPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.ministries) notFound();

  const { site, content } = data;

  const blocks: BlockNode[] = [
    {
      id: "ministries-page",
      type: "section",
      style: { padding: "lg" },
      children: [
        { id: "ministries-eyebrow", type: "eyebrow", text: "Get Involved" },
        { id: "ministries-heading", type: "heading", text: "Ministries", scale: "h1" },
        { id: "ministries-collection", type: "ministryCollection" },
      ],
    },
  ];

  return <BlockTree nodes={blocks} site={site} content={content} />;
}
