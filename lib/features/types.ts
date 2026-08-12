export interface FeatureConfig {
  sermons: boolean;
  sermonSearch: boolean;
  events: boolean;
  youtube: boolean;
  podcast: boolean;
  giving: boolean;
  ministries: boolean;
  contact: boolean;
}

export const defaultFeatures: FeatureConfig = {
  sermons: true,
  sermonSearch: false,
  events: true,
  youtube: false,
  podcast: false,
  giving: false,
  ministries: false,
  contact: true,
};

/**
 * Centralized mapping from a feature flag to the section types it unlocks.
 * The renderer and navigation generator both read this instead of scattering
 * feature checks across components.
 */
export const featureRequirements: Record<keyof FeatureConfig, string[]> = {
  sermons: ["sermons"],
  sermonSearch: ["sermons", "sermonSearch"],
  events: ["events"],
  youtube: ["youtube"],
  podcast: ["podcast"],
  giving: ["giving"],
  ministries: ["ministries"],
  contact: ["contact"],
};

/** Section types that are always available regardless of feature flags. */
export const alwaysEnabledSectionTypes = new Set([
  "navbar",
  "hero",
  "welcome",
  "about",
  "cta",
  "footer",
]);
