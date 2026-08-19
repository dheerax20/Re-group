import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import type { BlockNode } from "@/lib/site/blocks/types";

export const revalidate = 300;

/**
 * A secondary page: a small deterministic block composition (not its own AI
 * agent — see the plan's cost/scope tradeoff) built from real site fields,
 * still rendered through the same generic `BlockTree` as the homepage.
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) notFound();

  const { site, content } = data;

  const blocks: BlockNode[] = [
    {
      id: "about-page",
      type: "section",
      style: { padding: "lg", align: "center" },
      children: [
        { id: "about-eyebrow", type: "eyebrow", text: "About Us" },
        { id: "about-heading", type: "heading", text: `Who We Are`, scale: "h1" },
        {
          id: "about-text",
          type: "text",
          text:
            site.brand.tagline ||
            `${site.site.name} exists to help people know God and grow in community. We gather to worship, learn, and serve together.`,
        },
      ],
    },
  ];

  if (site.features.ministries) {
    blocks.push({
      id: "about-ministries",
      type: "section",
      style: { padding: "lg" },
      children: [
        { id: "ministries-heading", type: "heading", text: "Ministries", scale: "h2" },
        { id: "ministries-collection", type: "ministryCollection" },
      ],
    });
  }

  return <BlockTree nodes={blocks} site={site} content={content} />;
}
