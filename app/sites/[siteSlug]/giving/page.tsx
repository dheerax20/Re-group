import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import type { BlockNode } from "@/lib/site/blocks/types";

export const revalidate = 300;

export default async function GivingPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.giving) notFound();

  const { site, content } = data;

  const blocks: BlockNode[] = [
    {
      id: "giving-page",
      type: "section",
      style: { padding: "lg", background: "primary", align: "center" },
      children: [
        { id: "giving-eyebrow", type: "eyebrow", text: "Generosity" },
        { id: "giving-heading", type: "heading", text: "Give Online", scale: "h1" },
        {
          id: "giving-text",
          type: "text",
          text: "Your generosity helps us serve our community and share hope with more people.",
        },
        { id: "giving-cta", type: "givingCta" },
      ],
    },
  ];

  return <BlockTree nodes={blocks} site={site} content={content} />;
}
