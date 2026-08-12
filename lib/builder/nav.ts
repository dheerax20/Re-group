export const builderNavItems = [
  { key: "overview", label: "Overview", path: "", icon: "LayoutDashboard" },
  { key: "events", label: "Events", path: "events", icon: "Calendar" },
  { key: "sermons", label: "Sermons", path: "sermons", icon: "Mic2" },
  { key: "youtube", label: "YouTube", path: "youtube", icon: "Video" },
] as const;

export function builderHref(siteId: string, path: string) {
  return path ? `/builder/${siteId}/${path}` : `/builder/${siteId}`;
}
