import { FeatureConfig } from "./types";

export interface FeatureDependencyError {
  field: keyof FeatureConfig;
  message: string;
}

/**
 * Feature dependency rules live here and only here. Add new rules to this
 * array rather than sprinkling `if` checks around the app.
 */
const dependencyRules: Array<{
  field: keyof FeatureConfig;
  requires: keyof FeatureConfig;
  message: string;
}> = [
  {
    field: "sermonSearch",
    requires: "sermons",
    message: "Sermon search requires sermons to be enabled",
  },
];

export function validateFeatureDependencies(
  features: FeatureConfig
): FeatureDependencyError[] {
  const errors: FeatureDependencyError[] = [];

  for (const rule of dependencyRules) {
    if (features[rule.field] && !features[rule.requires]) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }

  return errors;
}

export function assertFeatureDependencies(features: FeatureConfig): void {
  const errors = validateFeatureDependencies(features);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
}

/**
 * Given a set of enabled features, returns whether a given section type
 * should be considered for rendering. Sections not tied to any feature
 * (navbar, hero, welcome, about, cta, footer) are always allowed here;
 * the renderer still checks `section.enabled` separately.
 */
export function isFeatureEnabled(
  sectionType: string,
  features: FeatureConfig
): boolean {
  const featureKey = sectionType as keyof FeatureConfig;
  if (!(featureKey in features)) {
    return true;
  }
  return Boolean(features[featureKey]);
}
