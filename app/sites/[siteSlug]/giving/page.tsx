import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { getPageBlocks } from "@/lib/site/blocks/resolve-page";
import { BlockTree } from "@/components/website/blocks/block-renderer";

export const revalidate = 300;

/**
 * Renders whatever this page's stored block tree says.
 *
 * The composition used to be written inline here and rebuilt on every render,
 * which is why nothing could edit it: there was no stored content to change.
 * The default now lives in `lib/site/blocks/default-pages.ts`, and
 * `getPageBlocks` prefers the church's own `SitePage` row once one exists.
 */
export default async function GivingPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.giving) notFound();

  const { site, content } = data;

  return (
    <BlockTree nodes={getPageBlocks(site, "/giving")} site={site} content={content} />
  );
}
