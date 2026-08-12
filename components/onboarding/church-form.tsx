"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { churchInfoSchema, type ChurchInfoInput } from "@/lib/validation/church";
import { updateChurchInfo } from "@/lib/site/actions";
import { SiteConfig } from "@/lib/site/types";
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

export function ChurchForm({
  siteId,
  defaultValues,
  nextHref,
  onSaved,
  submitLabel = "Continue",
}: {
  siteId: string;
  defaultValues: SiteConfig;
  nextHref?: string;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChurchInfoInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(churchInfoSchema) as any,
    defaultValues: {
      name: defaultValues.site.name === "Untitled Church" ? "" : defaultValues.site.name,
      denomination: defaultValues.site.denomination ?? "",
      congregationSize: defaultValues.site.congregationSize,
      primaryContactName: "",
      primaryContactEmail: defaultValues.contact?.email ?? "",
      primaryContactPhone: defaultValues.contact?.phone ?? "",
      tagline: defaultValues.brand.tagline ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    await updateChurchInfo(siteId, data);
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
        title="Church profile"
        description="Used for recommendations, SEO, and site-wide copy."
      >
        <Field>
          <Label htmlFor="name">Church name</Label>
          <Input id="name" {...register("name")} placeholder="Grace Community Church" />
          <FieldHint>Appears in navbar, footer, and page titles.</FieldHint>
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="denomination">Denomination</Label>
            <Input id="denomination" {...register("denomination")} placeholder="Baptist" />
          </Field>
          <Field>
            <Label htmlFor="congregationSize">Congregation size</Label>
            <Input
              id="congregationSize"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register("congregationSize", {
                setValueAs: (v) => {
                  if (v === "" || v === null || v === undefined) return undefined;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : undefined;
                },
              })}
              placeholder="150"
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                  e.preventDefault();
                }
              }}
            />
            <FieldHint>Positive whole numbers only.</FieldHint>
            <FieldError>{errors.congregationSize?.message as string | undefined}</FieldError>
          </Field>
        </div>

        <Field>
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" {...register("tagline")} placeholder="A place to belong" />
          <FieldHint>Short line for hero and template matching.</FieldHint>
        </Field>
      </FieldGroup>

      <FieldGroup
        title="Primary contact"
        description="Optional — helps personalize contact sections later."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="primaryContactName">Name</Label>
            <Input id="primaryContactName" {...register("primaryContactName")} />
          </Field>
          <Field>
            <Label htmlFor="primaryContactPhone">Phone</Label>
            <Input id="primaryContactPhone" {...register("primaryContactPhone")} />
          </Field>
        </div>
        <Field>
          <Label htmlFor="primaryContactEmail">Email</Label>
          <Input
            id="primaryContactEmail"
            type="email"
            {...register("primaryContactEmail")}
            placeholder="hello@church.org"
          />
          <FieldError>{errors.primaryContactEmail?.message}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions>
        <span />
        <div className="flex items-center gap-3">
          {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </FormActions>
    </form>
  );
}
