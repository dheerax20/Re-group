export const ACTIVE_SITE_COOKIE = "regroup-active-site";

/** Wizard steps live under `/builder/<step>` and must not be treated as site ids. */
export const BUILDER_WIZARD_SEGMENTS = new Set([
  "church",
  "brand",
  "social",
  "features",
  "templates",
  "publish",
]);
