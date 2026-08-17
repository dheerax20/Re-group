import { cn } from "@/lib/utils";
import { SiteConfig, SiteContent } from "@/lib/site/types";
import { isFeatureEnabled } from "@/lib/features/validate";
import { resolveSectionComponent } from "./section-registry";

export function WebsiteRenderer({
  site,
  content,
  editor,
}: {
  site: SiteConfig;
  content: SiteContent;
  editor?: {
    selectedId: string;
    onSelect: (id: string) => void;
  };
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

        if (!editor) {
          return (
            <Component
              key={section.id}
              site={site}
              config={section.config}
              content={content}
            />
          );
        }

        const selected = editor.selectedId === section.id;
        const overlayNav = section.type === "navbar";

        return (
          <div
            key={section.id}
            data-section-id={section.id}
            className={cn(
              "cursor-pointer",
              !overlayNav && "relative",
              overlayNav && "contents",
              selected && !overlayNav && "ring-2 ring-inset ring-[#d4a359]"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              editor.onSelect(section.id);
            }}
          >
            {!overlayNav ? (
              <span
                className={cn(
                  "pointer-events-none absolute left-3 top-3 z-20 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  selected
                    ? "bg-[#d4a359] text-[#1a1817]"
                    : "bg-black/55 text-white"
                )}
              >
                {section.type}
              </span>
            ) : null}
            <div className="pointer-events-none">
              <Component site={site} config={section.config} content={content} />
            </div>
          </div>
        );
      })}
    </>
  );
}
