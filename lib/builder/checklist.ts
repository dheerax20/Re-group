import type { SectionInstance, SiteConfig } from "@/lib/site/types";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";

export type EditorNeedCategory = "media" | "content" | "mobile" | "design" | "pages";

export type EditorNeed = {
  id: string;
  title: string;
  detail: string;
  category: EditorNeedCategory;
  action?: string;
  sectionType?: string;
  done: boolean;
};

function sectionImage(sections: SectionInstance[], type: string) {
  const row = sections.find((s) => s.type === type && s.enabled);
  const url = row?.config?.imageUrl;
  return typeof url === "string" && url.trim().length > 0;
}

/** Build a full “needs coverage” list from AI feedback + live site gaps. */
export function buildEditorNeeds(
  site: Pick<
    SiteConfig,
    | "sections"
    | "navigation"
    | "features"
    | "improvements"
    | "designFeedback"
    | "mobileFeedback"
    | "youtube"
  >,
  sectionsOverride?: SectionInstance[]
): EditorNeed[] {
  const sections = sectionsOverride ?? site.sections;
  const needs: EditorNeed[] = [];

  const pushUnique = (need: EditorNeed) => {
    if (needs.some((n) => n.id === need.id)) return;
    needs.push(need);
  };

  pushUnique({
    id: "media-hero",
    title: "Hero photo",
    detail: "Add a worship or sanctuary photo so the homepage feels like your church.",
    category: "media",
    action: "upload_hero_photo",
    sectionType: "hero",
    done: sectionImage(sections, "hero"),
  });

  if (sections.some((s) => s.type === "welcome" && s.enabled)) {
    pushUnique({
      id: "media-welcome",
      title: "Welcome photo or video",
      detail: "Add a welcome image or YouTube welcome video URL.",
      category: "media",
      action: "add_welcome_video",
      sectionType: "welcome",
      done:
        sectionImage(sections, "welcome") ||
        Boolean(
          sections.find((s) => s.type === "welcome")?.config?.videoUrl &&
            String(sections.find((s) => s.type === "welcome")?.config?.videoUrl).trim()
        ),
    });
  }

  if (sections.some((s) => s.type === "about" && s.enabled)) {
    pushUnique({
      id: "media-about",
      title: "About photo",
      detail: "Add a photo of your community, pastor, or building.",
      category: "media",
      action: "upload_hero_photo",
      sectionType: "about",
      done: sectionImage(sections, "about"),
    });
  }

  if (sections.some((s) => s.type === "cta" && s.enabled)) {
    pushUnique({
      id: "media-cta",
      title: "CTA background photo",
      detail: "Optional but strong — add a photo behind the visit CTA.",
      category: "media",
      sectionType: "cta",
      done: sectionImage(sections, "cta"),
    });
  }

  pushUnique({
    id: "pages-nav",
    title: "Pages & navbar links",
    detail: "Confirm navbar order and that each link goes to the right page.",
    category: "pages",
    done: (site.navigation?.length ?? 0) >= 2,
  });

  if (site.features.events) {
    pushUnique({
      id: "content-events",
      title: "Events photos & listings",
      detail: "Add upcoming gatherings and photos from the Events page.",
      category: "content",
      action: "add_event_photos",
      done: false,
    });
  }

  if (site.features.sermons) {
    pushUnique({
      id: "content-sermons",
      title: "Sermon media",
      detail: "Attach video or audio to recent messages.",
      category: "content",
      action: "add_sermon_video",
      done: false,
    });
  }

  if (site.features.youtube) {
pushUnique({
    id: "content-youtube",
    title: "Connect YouTube",
    detail: "Link your channel so live and recent videos appear.",
    category: "content",
    action: "connect_youtube",
    done: Boolean(site.youtube?.channelUrl),
  });
  }

  for (const item of site.improvements ?? []) {
    pushUnique(fromImprovement(item, sections));
  }
  for (const item of site.designFeedback ?? []) {
    pushUnique(fromFeedback(item, "design"));
  }
  for (const item of site.mobileFeedback ?? []) {
    pushUnique(fromFeedback(item, "mobile"));
  }

  return needs;
}

function fromImprovement(item: SiteImprovement, sections: SectionInstance[]): EditorNeed {
  const sectionType =
    item.action === "upload_hero_photo"
      ? "hero"
      : item.action === "add_welcome_video"
        ? "welcome"
        : undefined;
  let done = false;
  if (item.action === "upload_hero_photo") done = sectionImage(sections, "hero");
  if (item.action === "add_welcome_video") {
    done =
      sectionImage(sections, "welcome") ||
      Boolean(
        sections.find((s) => s.type === "welcome")?.config?.videoUrl &&
          String(sections.find((s) => s.type === "welcome")?.config?.videoUrl).trim()
      );
  }

  return {
    id: `imp-${item.action}-${item.title}`,
    title: item.title,
    detail: item.detail,
    category: item.action.includes("mobile")
      ? "mobile"
      : item.action.includes("photo") || item.action.includes("video") || item.action.includes("logo")
        ? "media"
        : "content",
    action: item.action,
    sectionType,
    done,
  };
}

function fromFeedback(
  item: DesignFeedback,
  fallback: "design" | "mobile"
): EditorNeed {
  const category: EditorNeedCategory =
    item.area === "mobile" || fallback === "mobile"
      ? "mobile"
      : item.area === "media"
        ? "media"
        : item.area === "content"
          ? "content"
          : "design";
  return {
    id: `fb-${fallback}-${item.title}`,
    title: item.title,
    detail: item.detail,
    category,
    done: false,
  };
}

export function countOpenNeeds(needs: EditorNeed[]) {
  return needs.filter((n) => !n.done).length;
}
