import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { resolveSectionComponent } from "@/components/website/renderer/section-registry";
import { WebsiteRenderer } from "@/components/website/renderer/website-renderer";
import { ThemeProvider } from "@/components/theme/theme-provider";

export default async function BuilderPreviewPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  const content = await getSiteContent(siteId);

  const navbarSection = site.sections.find((s) => s.type === "navbar" && s.enabled);
  const footerSection = site.sections.find((s) => s.type === "footer" && s.enabled);
  const Navbar = navbarSection ? resolveSectionComponent("navbar", navbarSection.variant) : null;
  const Footer = footerSection ? resolveSectionComponent("footer", footerSection.variant) : null;

  const pageSections = site.sections.filter((s) => s.type !== "navbar" && s.type !== "footer");

  return (
    <div>
      <div className="border-b border-neutral-200 bg-white px-6 py-3">
        <p className="text-sm text-neutral-500">
          This is a live preview using your saved brand, features, and content.
        </p>
      </div>
      <ThemeProvider brand={site.brand}>
        <div className="min-h-screen">
          {Navbar && navbarSection && (
            // eslint-disable-next-line react-hooks/static-components -- resolved from a fixed, static section registry, not created per render
            <Navbar site={site} config={navbarSection.config} content={content} />
          )}
          <WebsiteRenderer site={{ ...site, sections: pageSections }} content={content} />
          {Footer && footerSection && (
            // eslint-disable-next-line react-hooks/static-components -- resolved from a fixed, static section registry, not created per render
            <Footer site={site} config={footerSection.config} content={content} />
          )}
        </div>
      </ThemeProvider>
    </div>
  );
}
