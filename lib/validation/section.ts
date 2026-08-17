import { z } from "zod";
import { sectionTypes, type SectionType } from "@/lib/site/types";
import { sectionVariantOptions } from "@/lib/site/section-variants";
import { linkTargetSchema, mediaUrlSchema, httpsUrlSchema } from "./url";

/**
 * Section config used to be `z.record(z.string(), z.unknown())` — anything the
 * editor sent was accepted verbatim and then rendered into `href` and `src`
 * attributes on a public site. These schemas validate the fields that actually
 * reach the DOM.
 *
 * Unknown keys are preserved rather than stripped: the AI crew and templates
 * both write section-specific extras, and dropping them on every save would
 * quietly erase content. Only the fields below are constrained, and the render
 * layer additionally passes every URL through `safeLinkTarget` / `safeMediaUrl`
 * so a value written before these schemas existed still cannot ship.
 */

const ctaSchema = z.object({
  label: z.string().trim().max(80).optional(),
  href: linkTargetSchema.optional(),
});

const statSchema = z.object({
  label: z.string().trim().max(40),
  value: z.string().trim().max(40),
});

/** Shared across every section type. */
const sectionConfigShape = {
  eyebrow: z.string().trim().max(120).optional(),
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  body: z.string().trim().max(8000).optional(),

  imageUrl: mediaUrlSchema.optional(),
  videoUrl: mediaUrlSchema.optional(),
  backgroundUrl: mediaUrlSchema.optional(),

  primaryCta: ctaSchema.optional(),
  secondaryCta: ctaSchema.optional(),

  stats: z.array(statSchema).max(6).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().max(160),
        description: z.string().trim().max(1000).optional(),
        imageUrl: mediaUrlSchema.optional(),
        href: linkTargetSchema.optional(),
      })
    )
    .max(12)
    .optional(),

  // External services the church points at. `httpsUrlSchema` allows "" so a
  // field can be cleared without failing validation.
  channelUrl: httpsUrlSchema.optional(),
  rssUrl: httpsUrlSchema.optional(),
  givingUrl: httpsUrlSchema.optional(),
};

/** `looseObject` keeps unrecognised keys; the shape above is still enforced. */
export const sectionConfigObjectSchema = z.looseObject(sectionConfigShape);

export const sectionInstanceSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    type: z.enum(sectionTypes),
    variant: z.string().trim().min(1).max(40),
    enabled: z.boolean(),
    config: sectionConfigObjectSchema.default({}),
  })
  .superRefine((section, ctx) => {
    // The variant names a component in the section registry. An unknown value
    // renders nothing, so it is rejected here rather than discovered as a blank
    // band on a published page.
    if (!sectionVariantOptions[section.type].includes(section.variant)) {
      ctx.addIssue({
        code: "custom",
        path: ["variant"],
        message: `"${section.variant}" is not a ${section.type} layout`,
      });
    }
  });

export const sectionConfigSchema = z.array(sectionInstanceSchema).max(40);

export type SectionInstanceInput = z.infer<typeof sectionInstanceSchema>;

/**
 * Repairs a stored section list instead of rejecting it.
 *
 * Used on the read path, where throwing would take a published church site
 * down over one bad row. Unknown variants fall back to the first registered
 * layout for their type, unsafe URLs are dropped, and unrecognised section
 * types are removed.
 */
export function coerceSections(value: unknown): SectionInstanceInput[] {
  if (!Array.isArray(value)) return [];

  const repaired: SectionInstanceInput[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;

    if (!sectionTypes.includes(row.type as SectionType)) continue;
    const type = row.type as SectionType;

    const variants = sectionVariantOptions[type];
    const variant =
      typeof row.variant === "string" && variants.includes(row.variant)
        ? row.variant
        : variants[0];

    const parsedConfig = sectionConfigObjectSchema.safeParse(row.config ?? {});
    const config = parsedConfig.success
      ? parsedConfig.data
      : // Field-level failure: keep the section, drop only what failed.
        stripInvalidConfigFields(row.config);

    repaired.push({
      id: typeof row.id === "string" && row.id ? row.id.slice(0, 80) : type,
      type,
      variant,
      enabled: row.enabled !== false,
      config,
    });
  }

  return repaired;
}

/** Per-key salvage: parse each field alone and discard just the bad ones. */
function stripInvalidConfigFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(source)) {
    const field = sectionConfigShape[key as keyof typeof sectionConfigShape];
    if (!field) {
      result[key] = raw;
      continue;
    }
    const parsed = field.safeParse(raw);
    if (parsed.success) result[key] = parsed.data;
  }

  return result;
}
