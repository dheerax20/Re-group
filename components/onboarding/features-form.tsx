"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeatureConfig } from "@/lib/features/types";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { updateFeatures } from "@/lib/site/actions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FieldGroup, FormActions } from "@/components/onboarding/form-primitives";

const featureCopy: Array<{ key: keyof FeatureConfig; label: string; description: string }> = [
  { key: "sermons", label: "Sermons", description: "Publish messages with video, audio, and transcripts." },
  { key: "sermonSearch", label: "Sermon search", description: "Search past sermons. Requires sermons." },
  { key: "events", label: "Events", description: "Upcoming gatherings and calendar pages." },
  { key: "youtube", label: "YouTube", description: "Channel link and media section." },
  { key: "podcast", label: "Podcast", description: "RSS link and episode section." },
  { key: "giving", label: "Giving", description: "Online giving call-to-action." },
  { key: "ministries", label: "Ministries", description: "Highlight groups and teams." },
  { key: "contact", label: "Contact", description: "Contact details and visit CTA." },
];

export function FeaturesForm({
  siteId,
  defaultValues,
  backHref,
  nextHref,
  onSaved,
  submitLabel = "Continue",
}: {
  siteId: string;
  defaultValues: FeatureConfig;
  backHref?: string;
  nextHref?: string;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [features, setFeatures] = useState<FeatureConfig>(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const errors = validateFeatureDependencies(features);

  function toggle(key: keyof FeatureConfig, checked: boolean) {
    setFeatures((prev) => {
      const next = { ...prev, [key]: checked };
      if (key === "sermons" && !checked) next.sermonSearch = false;
      return next;
    });
  }

  async function onSubmit() {
    if (validateFeatureDependencies(features).length > 0) return;
    setSubmitting(true);
    try {
      await updateFeatures(siteId, features);
      if (nextHref) router.push(nextHref);
      else {
        onSaved?.();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <FieldGroup
        title="Site modules"
        description="These toggles control which sections and pages get generated."
      >
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {featureCopy.map(({ key, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 bg-surface px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-0.5 text-sm text-muted">{description}</p>
              </div>
              <Switch
                checked={features[key]}
                onCheckedChange={(checked) => toggle(key, checked)}
              />
            </div>
          ))}
        </div>
        {errors.length > 0 ? (
          <p className="text-sm text-red-600">{errors.map((e) => e.message).join(" ")}</p>
        ) : null}
      </FieldGroup>

      <FormActions>
        {backHref ? (
          <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || errors.length > 0}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </FormActions>
    </div>
  );
}
