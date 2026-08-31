export interface ChurchStory {
  city?: string;
  worshipStyle?: string;
  serviceTimes?: string;
  pastorName?: string;
  mission?: string;
  values?: string;
}

export type SiteImprovement = {
  title: string;
  detail: string;
  action: string;
};

export type DesignFeedback = {
  title: string;
  detail: string;
  area: string;
};

export function parseChurchStory(value: unknown): ChurchStory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const pick = (key: keyof ChurchStory) => {
    const v = record[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    city: pick("city"),
    worshipStyle: pick("worshipStyle"),
    serviceTimes: pick("serviceTimes"),
    pastorName: pick("pastorName"),
    mission: pick("mission"),
    values: pick("values"),
  };
}

/**
 * The story column with fresh AI feedback laid over it.
 *
 * Spreads the RAW stored object, not `parseChurchStory`'s projection. That
 * projection keeps exactly the six `ChurchStory` strings, so writing
 * `{ ...parseChurchStory(col), improvements, ... }` — which both edit paths
 * did — silently dropped every other key the column carries. `styleName` is
 * one of them, and `runCrewBuild` reads it to keep a church's chosen visual
 * style across rebuilds: one AI edit reset it. `agentLog` went the same way.
 *
 * Undo depends on this too. A snapshot that restores three keys is only
 * correct if the write it reverses touched three keys.
 */
export function withStoryFeedback(
  existing: unknown,
  feedback: {
    improvements?: SiteImprovement[];
    designFeedback?: DesignFeedback[];
    mobileFeedback?: DesignFeedback[];
  }
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  /**
   * All three keys are written every time, empty when the model offered
   * nothing. Leaving a stale list in place would show the church a "Needs"
   * checklist about a version of the page that no longer exists.
   */
  return {
    ...base,
    improvements: feedback.improvements ?? [],
    designFeedback: feedback.designFeedback ?? [],
    mobileFeedback: feedback.mobileFeedback ?? [],
  };
}

export function parseImprovements(value: unknown): SiteImprovement[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).improvements;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.title !== "string" || typeof row.detail !== "string") return null;
      return {
        title: row.title,
        detail: row.detail,
        action: typeof row.action === "string" ? row.action : "upload_hero_photo",
      };
    })
    .filter((item): item is SiteImprovement => item !== null);
}

function parseFeedbackList(value: unknown, key: string): DesignFeedback[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.title !== "string" || typeof row.detail !== "string") return null;
      return {
        title: row.title,
        detail: row.detail,
        area: typeof row.area === "string" ? row.area : "layout",
      };
    })
    .filter((item): item is DesignFeedback => item !== null);
}

export function parseDesignFeedback(value: unknown): DesignFeedback[] {
  return parseFeedbackList(value, "designFeedback");
}

export function parseMobileFeedback(value: unknown): DesignFeedback[] {
  return parseFeedbackList(value, "mobileFeedback");
}

export function parseAgentLog(value: unknown): Array<{ agent: string; role: string; summary: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).agentLog;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.summary !== "string") return null;
      return {
        agent: typeof row.agent === "string" ? row.agent : "agent",
        role: typeof row.role === "string" ? row.role : "Specialist",
        summary: row.summary,
      };
    })
    .filter((item): item is { agent: string; role: string; summary: string } => item !== null);
}

export function parseStyleName(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const style = (value as Record<string, unknown>).styleName;
  return typeof style === "string" && style.trim() ? style.trim() : undefined;
}

/**
 * The navbar treatment the build's design direction chose.
 *
 * Stored rather than re-derived from `styleName` through the direction table:
 * editing that table would otherwise restyle the nav of every published church
 * sharing a direction name, silently and with no rebuild.
 *
 * Falls back to `solid`, the treatment that works over any hero.
 */
export function parseNavVariant(value: unknown): "transparent" | "solid" | "minimal" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "solid";
  const variant = (value as Record<string, unknown>).navVariant;
  return variant === "transparent" || variant === "minimal" ? variant : "solid";
}

/** The stock photograph seeded into the hero, so the next build can avoid repeating it. */
export function parseHeroImage(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const url = (value as Record<string, unknown>).heroImageUrl;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
}
