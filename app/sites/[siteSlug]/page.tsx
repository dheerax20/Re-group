import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID } from "@/lib/site/blocks/types";

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

  // nav/footer are rendered once by the layout; the home page renders every
  // other block in the AI-composed (or legacy-adapted) order.
  const pageBlocks = site.blocks.filter((b) => b.id !== NAV_BLOCK_ID && b.id !== FOOTER_BLOCK_ID);

  return <BlockTree nodes={pageBlocks} site={site} content={content} />;
}
