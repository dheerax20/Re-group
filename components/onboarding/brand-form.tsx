"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  brandConfigSchema,
  defaultBrandConfig,
  normalizeHexColor,
  BrandConfigInput,
  BrandConfigFormValues,
} from "@/lib/validation/brand";
import { trpc } from "@/lib/trpc/client";
import { fontRegistry } from "@/lib/theme/font-registry";
import { generateThemeStyle } from "@/lib/theme/generate-theme";
import type { BrandConfig } from "@/lib/theme/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldHint,
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

type ColorName = "colors.primary" | "colors.secondary" | "colors.background" | "colors.foreground";

/**
 * A swatch and a hex box that are the same value.
 *
 * They used to be two `register()` calls on the same field name. React Hook
 * Form keeps one ref per name, so the second registration won and neither
 * input was ever written back to after mount: dragging the swatch moved the
 * form state and the preview but left the hex text stale, and typing a hex
 * left the swatch stale. `Controller` makes both controlled off one value, so
 * whichever the church touches, the other follows.
 */
function ColorField({
  control,
  name,
  label,
}: {
  control: Control<BrandConfigFormValues, unknown, BrandConfigInput>;
  name: ColorName;
  label: string;
}) {
  const fallback = defaultBrandConfig.colors[name.split(".")[1] as keyof typeof defaultBrandConfig.colors];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          <Label htmlFor={name}>{label}</Label>
          <div className="flex items-center gap-2">
            <input
              id={name}
              type="color"
              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
              /*
                `<input type="color">` accepts `#rrggbb` and nothing else. The
                schema also allows `#rgb`, and a half-typed `#ab` is neither —
                handing either to the swatch makes the browser silently snap to
                black, i.e. show a colour the church never picked.
              */
              value={normalizeHexColor(field.value, fallback)}
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
              onBlur={field.onBlur}
            />
            <Input
              value={field.value ?? ""}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              aria-label={`${label} hex value`}
              aria-invalid={fieldState.error ? true : undefined}
              className="font-mono text-xs uppercase"
            />
          </div>
          <FieldError>{fieldState.error?.message}</FieldError>
        </Field>
      )}
    />
  );
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
          <ColorField control={control} name="colors.primary" label="Primary" />
          <ColorField control={control} name="colors.secondary" label="Secondary" />
          <ColorField control={control} name="colors.background" label="Background" />
          <ColorField control={control} name="colors.foreground" label="Text" />
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
        {/*
          Stacked rather than the two-column grid the other groups use: the
          favicon needs an explainer image, and beside a bare Upload button in
          the next column the two halves ended up wildly different heights.
        */}
        <div className="grid grid-cols-1 gap-4">
          <Field>
            <Label htmlFor="logo">Logo</Label>
            <input
              id="logo"
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => logoInputRef.current?.click()}
            >
              {uploading === "logo" ? "Uploading..." : values.logo.url ? "Change logo" : "Upload logo"}
            </Button>
          </Field>
          <Field>
            <Label htmlFor="favicon">Favicon</Label>
            {/*
              "Favicon" is jargon, and the field was a bare button — a church
              had no way to know what it was being asked for. The picture
              answers it faster than the sentence does, so it leads.

              A plain <img>, matching the logo preview below: `ufs.sh` is not
              in next.config's `remotePatterns`, so `next/image` would 400 on
              it without a config change this one decorative asset does not
              justify.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://8qsia8g9sr.ufs.sh/f/d84d87qBVFDdFzTVOlkjhruTU0X3Nbvil6SHPWZeIdAkLzpf"
              alt="A browser tab showing a small square church icon beside the church's name"
              width={653}
              height={117}
              className="w-full max-w-sm rounded-lg"
            />
            <FieldHint>
              The small square icon in a browser tab, beside your church&rsquo;s
              name. A square image works best.
            </FieldHint>
            <input
              id="favicon"
              ref={faviconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFaviconChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
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
