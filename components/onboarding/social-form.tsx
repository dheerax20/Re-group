"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { socialLinksSchema, socialPlatforms } from "@/lib/validation/social";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldHint,
  FormActions,
} from "@/components/onboarding/form-primitives";

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

export function SocialForm({
  siteId,
  defaultValues,
  backHref,
  nextHref,
  onSaved,
  submitLabel = "Continue",
}: {
  siteId: string;
  defaultValues: Array<{ platform: string; url: string }>;
  backHref?: string;
  nextHref?: string;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const updateSocial = trpc.content.updateSocial.useMutation();
  const [saved, setSaved] = useState(false);
  const existing = Object.fromEntries(defaultValues.map((l) => [l.platform, l.url]));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(socialLinksSchema),
    defaultValues: {
      facebook: existing.facebook ?? "",
      instagram: existing.instagram ?? "",
      youtube: existing.youtube ?? "",
      x: existing.x ?? "",
      tiktok: existing.tiktok ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    await updateSocial.mutateAsync({ siteId, data });
    if (nextHref) {
      router.push(nextHref);
    } else {
      onSaved?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <FieldGroup
        index={1}
        title="Social profiles"
        description="Leave blank if you don’t use a platform. Only valid URLs are saved."
      >
        {socialPlatforms.map((platform) => (
          <Field key={platform}>
            <Label htmlFor={platform}>{platformLabels[platform]}</Label>
            <Input
              id={platform}
              type="url"
              inputMode="url"
              {...register(platform)}
              placeholder={`https://${platform === "x" ? "x.com" : platform + ".com"}/yourchurch`}
            />
            <FieldError>{errors[platform]?.message as string | undefined}</FieldError>
          </Field>
        ))}
        <FieldHint>These feed footer links and social sections when enabled.</FieldHint>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </FormActions>
    </form>
  );
}
