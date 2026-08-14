export interface ChurchStory {
  city?: string;
  worshipStyle?: string;
  serviceTimes?: string;
  pastorName?: string;
  mission?: string;
  values?: string;
}

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
