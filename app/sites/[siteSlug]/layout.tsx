import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { resolveSectionComponent } from "@/components/website/renderer/section-registry";
import { ThemeProvider } from "@/components/theme/theme-provider";

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

  const navbarSection = site.sections.find((s) => s.type === "navbar" && s.enabled);
  const footerSection = site.sections.find((s) => s.type === "footer" && s.enabled);

  const Navbar = navbarSection
    ? resolveSectionComponent("navbar", navbarSection.variant)
    : null;
  const Footer = footerSection
    ? resolveSectionComponent("footer", footerSection.variant)
    : null;

  return (
    <ThemeProvider brand={site.brand}>
      <div className="flex min-h-screen flex-col">
        {Navbar && navbarSection && (
          // eslint-disable-next-line react-hooks/static-components -- resolved from a fixed, static section registry, not created per render
          <Navbar site={site} config={navbarSection.config} content={content} />
        )}
        <div className="flex-1">{children}</div>
        {Footer && footerSection && (
          // eslint-disable-next-line react-hooks/static-components -- resolved from a fixed, static section registry, not created per render
          <Footer site={site} config={footerSection.config} content={content} />
        )}
      </div>
    </ThemeProvider>
  );
}
