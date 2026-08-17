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
