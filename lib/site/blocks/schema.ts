import { z } from "zod";
import { linkTargetSchema, mediaUrlSchema, safeLinkTarget, safeMediaUrl } from "@/lib/validation/url";
import type { BlockNode, PageBlocks } from "./types";
import type { SectionInstance } from "@/lib/site/types";

const spacingSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl", "2xl"]);
const alignSchema = z.enum(["left", "center", "right"]);
const widthSchema = z.enum(["narrow", "normal", "wide", "full", "bleed"]);
const surfaceSchema = z.enum(["transparent", "surface", "primary", "accent", "inverted"]);
const textToneSchema = z.enum(["default", "muted", "inverted", "accent"]);
const typeScaleSchema = z.enum(["display", "h1", "h2", "h3", "body", "small"]);
const accentSchema = z.enum(["none", "line", "bordered", "numbered"]);
const imageTreatmentSchema = z.enum(["rounded", "square", "framed", "bleed"]);
const imageAspectSchema = z.enum(["square", "video", "portrait", "wide", "cinema", "fill"]);
const buttonEmphasisSchema = z.enum(["primary", "secondary", "outline"]);
const fontFamilySchema = z.enum(["primary", "secondary"]);
const columnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const rowLayoutSchema = z.enum(["columns", "bar", "wide-left", "wide-right"]);
const overlaySchema = z.enum(["none", "scrim", "dark"]);
const minHeightSchema = z.enum(["none", "hero", "screen"]);
const fontWeightSchema = z.enum(["regular", "semibold", "bold"]);

const blockStyleSchema = z
  .object({
    padding: spacingSchema.optional(),
    gap: spacingSchema.optional(),
    align: alignSchema.optional(),
    width: widthSchema.optional(),
    background: surfaceSchema.optional(),
    textTone: textToneSchema.optional(),
    /**
     * Validated like every other URL that reaches a `src` — a stored tree is
     * not trusted input just because a template wrote it once.
     */
    backgroundImage: mediaUrlSchema.optional(),
    overlay: overlaySchema.optional(),
    minHeight: minHeightSchema.optional(),
  })
  .optional();

const idSchema = z.string().trim().min(1).max(60);

const STYLE_FIELD_SCHEMAS = {
  padding: spacingSchema,
  gap: spacingSchema,
  align: alignSchema,
  width: widthSchema,
  background: surfaceSchema,
  textTone: textToneSchema,
  backgroundImage: mediaUrlSchema,
  overlay: overlaySchema,
  minHeight: minHeightSchema,
} as const;

/**
 * Keeps the style keys that parse and drops only the ones that don't.
 *
 * `repairBlocks` used to delete the whole `style` object when any single field
 * failed, so one hallucinated enum value (`padding: "huge"`) cost that band its
 * padding, background AND alignment at once — a silent quality cliff that read
 * as the model producing a bad layout. This is the same per-field salvage
 * `coerceSections` does in `lib/validation/section.ts`, applied here.
 */
function salvageStyle(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(STYLE_FIELD_SCHEMAS)) {
    if (raw[key] === undefined) continue;
    const parsed = schema.safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Node count is capped at parse time per-array below; this is a hard ceiling on recursion depth. */
const MAX_DEPTH = 6;

export const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id: idSchema,
      type: z.literal("section"),
      style: blockStyleSchema,
      children: z.array(blockNodeSchema).max(24),
    }),
    z.object({
      id: idSchema,
      type: z.literal("stack"),
      style: blockStyleSchema,
      children: z.array(blockNodeSchema).max(24),
    }),
    z.object({
      id: idSchema,
      type: z.literal("row"),
      style: blockStyleSchema,
      columns: columnsSchema.optional(),
      layout: rowLayoutSchema.optional(),
      children: z.array(blockNodeSchema).max(8),
    }),
    z.object({
      id: idSchema,
      type: z.literal("spacer"),
      style: blockStyleSchema,
      size: spacingSchema.optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("heading"),
      style: blockStyleSchema,
      text: z.string().trim().min(1).max(200),
      scale: typeScaleSchema.optional(),
      weight: fontWeightSchema.optional(),
      font: fontFamilySchema.optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("text"),
      style: blockStyleSchema,
      text: z.string().trim().min(1).max(2000),
      scale: typeScaleSchema.optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("eyebrow"),
      style: blockStyleSchema,
      text: z.string().trim().min(1).max(80),
      accent: accentSchema.optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("image"),
      style: blockStyleSchema,
      src: mediaUrlSchema.optional(),
      videoSrc: mediaUrlSchema.optional(),
      alt: z.string().max(200).optional(),
      treatment: imageTreatmentSchema.optional(),
      aspect: imageAspectSchema.optional(),
      priority: z.boolean().optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("button"),
      style: blockStyleSchema,
      label: z.string().trim().min(1).max(60),
      href: linkTargetSchema,
      emphasis: buttonEmphasisSchema.optional(),
      font: fontFamilySchema.optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("stats"),
      style: blockStyleSchema,
      items: z.array(z.object({ label: z.string().max(40), value: z.string().max(40) })).max(6),
    }),
    z.object({ id: idSchema, type: z.literal("navLinks"), style: blockStyleSchema }),
    z.object({ id: idSchema, type: z.literal("brandLogo"), style: blockStyleSchema }),
    z.object({
      id: idSchema,
      type: z.literal("sermonCollection"),
      style: blockStyleSchema,
      layout: z.enum(["grid", "list", "featured"]).optional(),
      limit: z.number().int().min(1).max(12).optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("eventCollection"),
      style: blockStyleSchema,
      layout: z.enum(["grid", "list", "calendar"]).optional(),
      limit: z.number().int().min(1).max(12).optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal("ministryCollection"),
      style: blockStyleSchema,
      items: z
        .array(z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200) }))
        .max(8)
        .optional(),
    }),
    z.object({ id: idSchema, type: z.literal("contactInfo"), style: blockStyleSchema }),
    z.object({ id: idSchema, type: z.literal("givingCta"), style: blockStyleSchema }),
    z.object({ id: idSchema, type: z.literal("socialLinks"), style: blockStyleSchema }),
    z.object({ id: idSchema, type: z.literal("copyrightLine"), style: blockStyleSchema }),
  ])
);

export const pageBlocksSchema = z.array(blockNodeSchema).max(16);

/** Truncates `children` once nesting exceeds MAX_DEPTH, so a pathological/malicious tree can't blow the stack before validation ever runs. */
function capDepth(value: unknown, depth: number): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => capDepth(item, depth));
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.children)) return obj;
  if (depth >= MAX_DEPTH) return { ...obj, children: [] };
  return { ...obj, children: obj.children.map((child) => capDepth(child, depth + 1)) };
}

/**
 * Validates + repairs a value that is supposed to be a page's block tree.
 * Used on every read (AI output, builder writes, and the public render path)
 * — never throws. A node that fails validation (itself or any descendant) is
 * simply dropped; siblings and the rest of the page still render. This is
 * coarser than `coerceSections`' per-field salvage, but a block tree is
 * AI-authored per build rather than hand-edited field by field, so whole-node
 * drop-and-move-on is an acceptable trade for staying simple here.
 */
export function coerceBlocks(value: unknown): PageBlocks {
  if (!Array.isArray(value)) return [];

  const capped = capDepth(value, 0) as unknown[];
  const result: BlockNode[] = [];

  for (const raw of capped) {
    const parsed = blockNodeSchema.safeParse(raw);
    if (parsed.success) result.push(parsed.data);
  }

  return result;
}

/**
 * Fills in every `id` the model left out, and breaks duplicates.
 *
 * The composer runs in OpenAI's non-strict structured-output mode (the block
 * tree is a recursive union, which strict mode rejects outright), so
 * `required` in the schema is a strong hint and nothing more — in practice
 * the model reliably omits `id` on nested nodes. Ids are plumbing: React
 * keys and the visual editor's node handles. Failing a whole build over
 * plumbing the model was never going to get right is the wrong trade, so we
 * mint them here instead. Model-supplied ids win when present and unique,
 * which is what keeps the reserved `nav`/`footer` bands intact.
 */
export function ensureBlockIds(value: unknown): unknown {
  const seen = new Set<string>();
  let counter = 0;

  const mint = (type: unknown): string => {
    counter += 1;
    return `${typeof type === "string" ? type : "block"}-${counter}`;
  };

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;

    const obj = { ...(node as Record<string, unknown>) };
    const given = typeof obj.id === "string" ? obj.id.trim().slice(0, 60) : "";
    let id = given && !seen.has(given) ? given : mint(obj.type);
    while (seen.has(id)) id = mint(obj.type);
    seen.add(id);
    obj.id = id;

    if (Array.isArray(obj.children)) obj.children = obj.children.map(walk);
    return obj;
  };

  return walk(value);
}

/**
 * Like `coerceBlocks`, but prunes bottom-up instead of dropping whole roots.
 *
 * `coerceBlocks` validates each top-level node as one unit, so a single bad
 * descendant — a heading the model left textless, an `aspect` it invented —
 * deletes the entire band. That is the right call for stored data, which was
 * valid when it was written. It is the wrong call for a fresh model response,
 * where a couple of malformed leaves out of eighty are normal and would
 * otherwise cost the church a whole section of their homepage.
 *
 * Here each node is repaired from the leaves up: children are pruned first, a
 * `style` object that doesn't validate is dropped rather than taken as fatal,
 * and only then is the node itself checked. A node that still fails is
 * dropped alone; its siblings and its parent survive.
 */
export function repairBlocks(value: unknown): PageBlocks {
  if (!Array.isArray(value)) return [];

  const prune = (raw: unknown): BlockNode | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const candidate: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
    if (Array.isArray(candidate.children)) {
      candidate.children = candidate.children
        .map(prune)
        .filter((child): child is BlockNode => child !== null);
    }
    if (candidate.style !== undefined) {
      const salvaged = salvageStyle(candidate.style);
      if (salvaged) candidate.style = salvaged;
      else delete candidate.style;
    }

    const parsed = blockNodeSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  };

  return (capDepth(value, 0) as unknown[])
    .map(prune)
    .filter((node): node is BlockNode => node !== null);
}

/** True when a stored value is the OLD `SectionInstance[]` shape rather than a block tree — every legacy item carries a `variant` key, which no block ever has. */
export function looksLikeLegacySections(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).variant === "string"
  );
}

/**
 * A minimal, always-safe nav band — used both by the legacy adapter and as the
 * composer's fallback when the model omits `id: "nav"`.
 *
 * No `padding`: the renderer owns a pinned band's height
 * (`pinnedBandClass` in `components/website/blocks/tokens.ts`) and ignores the
 * token, because a band's padding scale starts at 40px a side and a navbar
 * wants 16. The nav's own bar is rendered by `SiteHeader` rather than by this
 * row — see `components/website/blocks/site-header.tsx`; the band survives as
 * the marker the builder, the editor prompt and the public layout look it up
 * by. `normalizePinnedBands` in the design pass enforces the shape on
 * whatever the model actually emitted.
 */
export function defaultNavBlock(): BlockNode {
  return {
    id: "nav",
    type: "section",
    style: { width: "wide" },
    children: [
      {
        id: "nav-row",
        type: "row",
        layout: "bar",
        children: [
          { id: "nav-brand", type: "brandLogo" },
          { id: "nav-links", type: "navLinks" },
        ],
      },
    ],
  };
}

/** Same idea for the footer band. */
export function defaultFooterBlock(): BlockNode {
  return {
    id: "footer",
    type: "section",
    style: { width: "wide" },
    children: [
      {
        id: "footer-row",
        type: "row",
        layout: "bar",
        children: [
          { id: "footer-copyright", type: "copyrightLine" },
          { id: "footer-links", type: "navLinks" },
        ],
      },
    ],
  };
}

let legacyIdCounter = 0;
function nextId(prefix: string): string {
  legacyIdCounter += 1;
  return `${prefix}-legacy-${legacyIdCounter}`;
}

function str(config: Record<string, unknown>, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Appends a heading/text/eyebrow block only when it actually has text.
 *
 * `coerceBlocks` drops a whole top-level node when ANY descendant fails
 * validation, and the text/heading schemas are `.min(1)` — so emitting a
 * block with an empty string (very common in legacy data, where the old
 * components supplied their own defaults rather than storing them) would
 * silently delete the entire band from a published page.
 */
function pushIfText(
  children: BlockNode[],
  node: { id: string; type: "heading"; text: string; scale?: HeadingScale } | { id: string; type: "text"; text: string } | { id: string; type: "eyebrow"; text: string }
): void {
  if (node.text.trim().length > 0) children.push(node as BlockNode);
}

type HeadingScale = "display" | "h1" | "h2" | "h3" | "body" | "small";

/** Legacy ministries were stored as `config.items` with `name`/`description`. */
function legacyMinistryItems(
  config: Record<string, unknown>
): Array<{ name: string; description: string }> | undefined {
  const raw = config.items;
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
    }))
    .filter((item) => item.name.length > 0);
  return items.length > 0 ? items : undefined;
}

function cta(config: Record<string, unknown>, key: string, fallback: { label: string; href: string }) {
  const raw = config[key];
  const c = typeof raw === "object" && raw !== null ? (raw as { label?: unknown; href?: unknown }) : {};
  return {
    label: typeof c.label === "string" && c.label.trim() ? c.label.trim() : fallback.label,
    href: safeLinkTarget(c.href, fallback.href),
  };
}

/**
 * Synthesizes an equivalent block tree from data stored in the OLD
 * `SectionInstance[]` shape, so every already-published site keeps rendering
 * through the new generic block renderer without regenerating or losing
 * content. Approximate, not pixel-perfect — this is a compatibility shim for
 * old data, not a design goal in itself.
 */
export function legacySectionsToBlocks(
  sections: Array<{ type: string; variant?: string; enabled?: boolean; config: Record<string, unknown> }>,
  ctx: { youtubeChannelUrl?: string; podcastRssUrl?: string; givingUrl?: string } = {}
): PageBlocks {
  const blocks: BlockNode[] = [];

  for (const section of sections) {
    if (section.enabled === false) continue;
    const config = section.config ?? {};

    switch (section.type) {
      case "navbar":
        blocks.push(defaultNavBlock());
        break;

      case "footer":
        blocks.push(defaultFooterBlock());
        break;

      case "hero": {
        const primary = cta(config, "primaryCta", { label: "Plan Your Visit", href: "/contact" });
        const stats = config.stats as Array<{ label?: string; value?: string }> | undefined;
        const children: BlockNode[] = [];
        pushIfText(children, { id: nextId("eyebrow"), type: "eyebrow", text: str(config, "eyebrow", "Welcome") });
        pushIfText(children, { id: nextId("heading"), type: "heading", text: str(config, "title", "Welcome"), scale: "display" });
        pushIfText(children, { id: nextId("text"), type: "text", text: str(config, "description", "") });
        children.push({
          id: nextId("button"),
          type: "button",
          label: primary.label,
          href: primary.href,
          emphasis: "primary",
        });
        if (Array.isArray(stats) && stats.length > 0) {
          children.push({
            id: nextId("stats"),
            type: "stats",
            items: stats
              .filter((s) => s.label && s.value)
              .map((s) => ({ label: s.label as string, value: s.value as string })),
          });
        }
        const imageUrl = safeMediaUrl(config.imageUrl);
        blocks.push({
          id: nextId("hero"),
          type: "section",
          style: { padding: "xl", background: "primary", width: "full" },
          children: imageUrl
            ? [
                {
                  id: nextId("hero-row"),
                  type: "row",
                  columns: 2,
                  children: [
                    { id: nextId("hero-stack"), type: "stack", children },
                    { id: nextId("hero-image"), type: "image", src: imageUrl, treatment: "rounded", aspect: "portrait" },
                  ],
                },
              ]
            : [{ id: nextId("hero-stack"), type: "stack", children }],
        });
        break;
      }

      case "welcome":
      case "about": {
        const imageUrl = safeMediaUrl(config.imageUrl);
        const stackChildren: BlockNode[] = [];
        pushIfText(stackChildren, { id: nextId("eyebrow"), type: "eyebrow", text: str(config, "eyebrow", "Welcome") });
        pushIfText(stackChildren, { id: nextId("heading"), type: "heading", text: str(config, "title", ""), scale: "h2" });
        pushIfText(stackChildren, { id: nextId("text"), type: "text", text: str(config, "description", "") });
        // An entirely empty band would render as a bare padded div.
        if (stackChildren.length === 0) break;
        const textStack: BlockNode = {
          id: nextId("stack"),
          type: "stack",
          children: stackChildren,
        };
        blocks.push({
          id: nextId(section.type),
          type: "section",
          style: { padding: "lg" },
          children: imageUrl
            ? [
                {
                  id: nextId("row"),
                  type: "row",
                  columns: 2,
                  children: [
                    { id: nextId("image"), type: "image", src: imageUrl, treatment: "rounded", aspect: "wide" },
                    textStack,
                  ],
                },
              ]
            : [textStack],
        });
        break;
      }

      case "sermons": {
        const layout = section.variant === "featured" ? "featured" : section.variant === "list" ? "list" : "grid";
        blocks.push({
          id: nextId("sermons"),
          type: "section",
          style: { padding: "lg" },
          children: [
            { id: nextId("eyebrow"), type: "eyebrow", text: str(config, "eyebrow", "Latest Sermons") },
            { id: nextId("heading"), type: "heading", text: str(config, "title", "Recent Messages"), scale: "h2" },
            { id: nextId("collection"), type: "sermonCollection", layout },
          ],
        });
        break;
      }

      case "events": {
        const layout = section.variant === "calendar" ? "calendar" : section.variant === "list" ? "list" : "grid";
        blocks.push({
          id: nextId("events"),
          type: "section",
          style: { padding: "lg" },
          children: [
            { id: nextId("eyebrow"), type: "eyebrow", text: str(config, "eyebrow", "Upcoming Events") },
            { id: nextId("heading"), type: "heading", text: str(config, "title", "What's Happening"), scale: "h2" },
            { id: nextId("collection"), type: "eventCollection", layout },
          ],
        });
        break;
      }

      case "ministries":
        blocks.push({
          id: nextId("ministries"),
          type: "section",
          style: { padding: "lg" },
          children: [
            { id: nextId("eyebrow"), type: "eyebrow", text: str(config, "eyebrow", "Get Involved") },
            { id: nextId("heading"), type: "heading", text: str(config, "title", "Ministries"), scale: "h2" },
            // Legacy ministries lived in `config.items` — carry them across
            // rather than dropping the church's actual ministry list.
            { id: nextId("collection"), type: "ministryCollection", items: legacyMinistryItems(config) },
          ],
        });
        break;

      case "giving":
        blocks.push({
          id: nextId("giving"),
          type: "section",
          style: { padding: "lg", background: "primary" },
          children: [{ id: nextId("giving-cta"), type: "givingCta" }],
        });
        break;

      case "youtube":
      case "podcast": {
        const href = section.type === "youtube" ? ctx.youtubeChannelUrl : ctx.podcastRssUrl;
        blocks.push({
          id: nextId(section.type),
          type: "section",
          style: { padding: "lg" },
          children: [
            {
              id: nextId("heading"),
              type: "heading",
              text: str(config, "title", section.type === "youtube" ? "Latest on YouTube" : "Our Podcast"),
              scale: "h2",
            },
            href
              ? {
                  id: nextId("button"),
                  type: "button",
                  label: section.type === "youtube" ? "Visit our Channel" : "Listen Now",
                  href: safeLinkTarget(href, "/"),
                  emphasis: "secondary",
                }
              : { id: nextId("text"), type: "text", text: "Link coming soon." },
          ],
        });
        break;
      }

      case "contact":
        blocks.push({
          id: nextId("contact"),
          type: "section",
          style: { padding: "lg", align: "center" },
          children: [
            { id: nextId("heading"), type: "heading", text: str(config, "title", "Contact Us"), scale: "h2" },
            { id: nextId("info"), type: "contactInfo" },
            { id: nextId("social"), type: "socialLinks" },
          ],
        });
        break;

      case "cta": {
        const primary = cta(config, config.cta ? "cta" : "primaryCta", {
          label: "Plan Your Visit",
          href: "/contact",
        });
        const ctaChildren: BlockNode[] = [];
        pushIfText(ctaChildren, { id: nextId("heading"), type: "heading", text: str(config, "title", "Join us"), scale: "h2" });
        pushIfText(ctaChildren, { id: nextId("text"), type: "text", text: str(config, "description", "") });
        ctaChildren.push({ id: nextId("button"), type: "button", label: primary.label, href: primary.href, emphasis: "primary" });
        blocks.push({
          id: nextId("cta"),
          type: "section",
          style: { padding: "lg", background: "primary", align: "center" },
          children: ctaChildren,
        });
        break;
      }

      default:
        break;
    }
  }

  return coerceBlocks(blocks);
}

/** Reads whatever shape is stored (`Site.sectionConfig`) and returns a validated block tree either way. */
export function toPageBlocks(
  value: unknown,
  ctx: { youtubeChannelUrl?: string; podcastRssUrl?: string; givingUrl?: string } = {}
): PageBlocks {
  if (looksLikeLegacySections(value)) {
    return legacySectionsToBlocks(value as unknown as SectionInstance[], ctx);
  }
  return coerceBlocks(value);
}
