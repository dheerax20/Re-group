export const wizardSteps = [
  { key: "church", label: "Church Info", path: "church" },
  { key: "social", label: "Social Media", path: "social" },
  { key: "brand", label: "Brand", path: "brand" },
  { key: "features", label: "Features", path: "features" },
  { key: "templates", label: "Templates", path: "templates" },
  { key: "publish", label: "Publish", path: "publish" },
] as const;

/** @deprecated use wizardSteps */
export const onboardingSteps = wizardSteps;

export function wizardHref(path: string, siteId: string) {
  return `/builder/${path}?siteId=${siteId}`;
}

/** @deprecated use wizardHref */
export function onboardingHref(path: string, siteId: string) {
  return wizardHref(path, siteId);
}
