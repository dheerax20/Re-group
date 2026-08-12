import { SiteConfig, SiteContent } from "@/lib/site/types";
import { isFeatureEnabled } from "@/lib/features/validate";
import { resolveSectionComponent } from "./section-registry";

export function WebsiteRenderer({
  site,
  content,
}: {
  site: SiteConfig;
  content: SiteContent;
}) {
  return (
    <>
      {site.sections.map((section) => {
        if (!section.enabled) return null;

        if (!isFeatureEnabled(section.type, site.features)) {
          return null;
        }

        const Component = resolveSectionComponent(section.type, section.variant);

        if (!Component) {
          console.error(
            `[WebsiteRenderer] Unknown section/variant "${section.type}/${section.variant}" on site ${site.site.slug} — skipping.`
          );
          return null;
        }

        return (
          <Component key={section.id} site={site} config={section.config} content={content} />
        );
      })}
    </>
  );
}
