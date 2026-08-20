"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeatureConfig } from "@/lib/features/types";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { trpc } from "@/lib/trpc/client";
import {
  Calendar,
  HandCoins,
  Heart,
  Mail,
  Mic2,
  Podcast,
  Search,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FieldGroup, FormActions } from "@/components/onboarding/form-primitives";
import { cn } from "@/lib/utils";

const featureCopy: Array<{
  key: keyof FeatureConfig;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { key: "sermons", label: "Sermons", description: "Publish messages with video, audio, and transcripts.", icon: Mic2 },
  { key: "sermonSearch", label: "Sermon search", description: "Search past sermons. Requires sermons.", icon: Search },
  { key: "events", label: "Events", description: "Upcoming gatherings and calendar pages.", icon: Calendar },
  { key: "youtube", label: "YouTube", description: "Channel link and media section.", icon: Video },
  { key: "podcast", label: "Podcast", description: "RSS link and episode section.", icon: Podcast },
  { key: "giving", label: "Giving", description: "Online giving call-to-action.", icon: HandCoins },
  { key: "ministries", label: "Ministries", description: "Highlight groups and teams.", icon: Heart },
  { key: "contact", label: "Contact", description: "Contact details and visit CTA.", icon: Mail },
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
  const updateFeatures = trpc.site.updateFeatures.useMutation();
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
      await updateFeatures.mutateAsync({ siteId, data: features });
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
        index={1}
        title="Site modules"
        description="These toggles control which sections and pages get generated."
      >
        {/*
          A card grid rather than a settings list. Eight rows of identical
          switches read as a preferences screen nobody scans; as cards, the lit
          ones are the shape of the site being built, which is what this step
          is actually asking about. The Switch stays inside each card so the
          control is still a real switch to a screen reader, not a div that
          happens to be clickable.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          {featureCopy.map(({ key, label, description, icon: Icon }) => {
            const on = features[key];
            return (
              <div
                key={key}
                className={cn(
                  "group/feat relative overflow-hidden rounded-panel border p-4 transition-all duration-300",
                  on
                    ? "border-brand/45 bg-brand-soft/40 shadow-[var(--shadow-soft)]"
                    : "border-border bg-surface hover:border-border-strong"
                )}
              >
                {/* Lit corner glow, only while the feature is on. */}
                {on ? (
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 100 100"
                    className="pointer-events-none absolute -right-6 -top-6 size-24 opacity-70"
                  >
                    <defs>
                      <radialGradient id={`glow-${key}`}>
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="50" fill={`url(#glow-${key})`} />
                  </svg>
                )  : null}

                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                      on ? "bg-brand text-brand-foreground" : "bg-surface-muted text-muted"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <Switch
                    checked={on}
                    onCheckedChange={(checked) => toggle(key, checked)}
                    aria-label={label}
                  />
                </div>

                <p className="relative mt-3 text-sm font-medium text-foreground">{label}</p>
                <p className="relative mt-0.5 text-[13px] leading-snug text-muted">
                  {description}
                </p>
              </div>
            );
          })}
        </div>
        {errors.length > 0 ? (
          <p className="text-sm text-destructive">{errors.map((e) => e.message).join(" ")}</p>
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
          {saved ? <span className="text-sm text-success">Saved</span> : null}
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
