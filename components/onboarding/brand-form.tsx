"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brandConfigSchema, BrandConfigInput } from "@/lib/validation/brand";
import { trpc } from "@/lib/trpc/client";
import { fontRegistry } from "@/lib/theme/fonts";
import { generateThemeStyle } from "@/lib/theme/generate-theme";
import type { BrandConfig } from "@/lib/theme/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FormActions,
} from "@/components/onboarding/form-primitives";
import { BrandPreview } from "@/components/onboarding/brand-preview";

async function uploadImage(siteId: string, type: "LOGO" | "FAVICON", file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("siteId", siteId);
  formData.append("type", type);
  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

export function BrandForm({
  siteId,
  defaultValues,
  churchName,
  backHref,
  nextHref,
  onSaved,
  submitLabel = "Continue",
}: {
  siteId: string;
  defaultValues: BrandConfigInput;
  churchName: string;
  backHref?: string;
  nextHref?: string;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const updateBrand = trpc.site.updateBrand.useMutation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(brandConfigSchema),
    defaultValues: defaultValues as BrandConfigInput,
  });

  // `useWatch` rather than `watch()`: watch returns a fresh function on every
  // render, which makes the whole component unmemoizable by the React Compiler.
  const values = useWatch({ control }) as unknown as BrandConfig;

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("logo");
    try {
      const url = await uploadImage(siteId, "LOGO", file);
      setValue("logo.url", url);
      setValue("logo.alt", churchName);
    } finally {
      setUploading(null);
    }
  }

  async function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("favicon");
    try {
      const url = await uploadImage(siteId, "FAVICON", file);
      setValue("favicon.url", url);
    } finally {
      setUploading(null);
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    await updateBrand.mutateAsync({ siteId, data });
    if (nextHref) router.push(nextHref);
    else {
      onSaved?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {/*
        Sits above the inputs, not beside them: on a phone a side-by-side
        preview collapses under the form and is never seen while the colours
        are actually being chosen.
      */}
      <BrandPreview
        colors={values?.colors ?? {}}
        primaryFont={values?.typography?.primaryFont}
        secondaryFont={values?.typography?.secondaryFont}
        churchName={churchName}
      />

      <FieldGroup
        index={1}
        title="Colors"
        description="These become CSS tokens across every template."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="colors.primary">Primary</Label>
            <div className="flex items-center gap-2">
              <input
                id="colors.primary"
                type="color"
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
                {...register("colors.primary")}
              />
              <Input {...register("colors.primary")} className="font-mono text-xs uppercase" />
            </div>
          </Field>
          <Field>
            <Label htmlFor="colors.secondary">Secondary</Label>
            <div className="flex items-center gap-2">
              <input
                id="colors.secondary"
                type="color"
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
                {...register("colors.secondary")}
              />
              <Input {...register("colors.secondary")} className="font-mono text-xs uppercase" />
            </div>
          </Field>
          <Field>
            <Label htmlFor="colors.background">Background</Label>
            <div className="flex items-center gap-2">
              <input
                id="colors.background"
                type="color"
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
                {...register("colors.background")}
              />
              <Input {...register("colors.background")} className="font-mono text-xs uppercase" />
            </div>
          </Field>
          <Field>
            <Label htmlFor="colors.foreground">Text</Label>
            <div className="flex items-center gap-2">
              <input
                id="colors.foreground"
                type="color"
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
                {...register("colors.foreground")}
              />
              <Input {...register("colors.foreground")} className="font-mono text-xs uppercase" />
            </div>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup index={2} title="Typography" description="Approved font registry only.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="primaryFont">Heading / body primary</Label>
            <NativeSelect id="primaryFont" {...register("typography.primaryFont")}>
              {Object.entries(fontRegistry).map(([key, font]) => (
                <option key={key} value={key}>
                  {font.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <Label htmlFor="secondaryFont">Display / secondary</Label>
            <NativeSelect id="secondaryFont" {...register("typography.secondaryFont")}>
              {Object.entries(fontRegistry).map(([key, font]) => (
                <option key={key} value={key}>
                  {font.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup index={3} title="Assets" description="Optional now — templates still look polished without them.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label>Logo</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => logoInputRef.current?.click()}
            >
              {uploading === "logo" ? "Uploading..." : values.logo.url ? "Change logo" : "Upload logo"}
            </Button>
          </Field>
          <Field>
            <Label>Favicon</Label>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFaviconChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => faviconInputRef.current?.click()}
            >
              {uploading === "favicon"
                ? "Uploading..."
                : values.favicon.url
                  ? "Change favicon"
                  : "Upload favicon"}
            </Button>
          </Field>
        </div>
        <Field>
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" {...register("tagline")} placeholder="A place to belong" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Live preview">
        <div
          style={generateThemeStyle(values)}
          className="theme-root rounded-xl border border-border p-8 text-center"
        >
          {values.logo.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.logo.url}
              alt={values.logo.alt}
              className="mx-auto h-12 object-contain"
            />
          ) : null}
          <h3 className="mt-3 text-xl font-semibold" style={{ fontFamily: "var(--font-primary)" }}>
            {churchName || "Your Church Name"}
          </h3>
          <p className="mt-1 text-sm opacity-80" style={{ fontFamily: "var(--font-secondary)" }}>
            {values.tagline || "Your tagline here"}
          </p>
          <button
            type="button"
            className="mt-5 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Plan Your Visit
          </button>
        </div>
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
