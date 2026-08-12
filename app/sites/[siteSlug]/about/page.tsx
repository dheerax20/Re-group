import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { resolveSectionComponent } from "@/components/website/renderer/section-registry";
import { AboutImageRight } from "@/components/website/sections/about";
import { MinistryGrid } from "@/components/website/sections/ministries";

export const revalidate = 300;

export default async function AboutPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data) notFound();

  const { site, content } = data;
  const aboutSection = site.sections.find((s) => s.type === "about");
  const About =
    (aboutSection && resolveSectionComponent("about", aboutSection.variant)) ||
    AboutImageRight;

  return (
    <>
      {/* eslint-disable-next-line react-hooks/static-components -- resolved from a fixed, static section registry, not created per render */}
      <About site={site} config={aboutSection?.config ?? {}} content={content} />
      {site.features.ministries && (
        <MinistryGrid site={site} config={{}} content={content} />
      )}
    </>
  );
}
