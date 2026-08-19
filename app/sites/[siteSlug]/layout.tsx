import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID } from "@/lib/site/blocks/types";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}): Promise<Metadata> {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) return {};

  const { site } = data;
  return {
    title: site.seo.title || site.site.name,
    description: site.seo.description,
    icons: site.brand.favicon.url ? { icon: site.brand.favicon.url } : undefined,
    openGraph: site.seo.ogImage
      ? { images: [{ url: site.seo.ogImage }] }
      : undefined,
    alternates: site.seo.canonicalUrl ? { canonical: site.seo.canonicalUrl } : undefined,
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) notFound();

  const { site, content } = data;

  const navBlock = site.blocks.find((b) => b.id === NAV_BLOCK_ID);
  const footerBlock = site.blocks.find((b) => b.id === FOOTER_BLOCK_ID);

  return (
    <ThemeProvider brand={site.brand}>
      <div className="flex min-h-screen flex-col">
        {navBlock ? <BlockTree nodes={[navBlock]} site={site} content={content} /> : null}
        <div className="flex-1">{children}</div>
        {footerBlock ? <BlockTree nodes={[footerBlock]} site={site} content={content} /> : null}
      </div>
    </ThemeProvider>
  );
}
