import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { z } from "zod";
import {
  mediaPlanSchema,
  producerBriefSchema,
  creativeBriefSchema,
  qaReportSchema,
  themeBriefSchema,
  pageComposerSchema,
  pageComposerResponseSchema,
  type MediaPlan,
  type ProducerBrief,
  type CreativeBrief,
  type QaReport,
  type ThemeBrief,
  type PageComposerOutput,
} from "./schemas";
import type { ArtDirection } from "./catalog";
import { buildRoleLlm, type Gateway } from "./model-config";

/**
 * Rewrites a zod-produced JSON Schema into the subset OpenAI's response_format
 * actually accepts.
 *
 * zod v4 emits `oneOf` for a `z.discriminatedUnion`, and OpenAI rejects the
 * whole request with `400 ... 'oneOf' is not permitted` — which is why every
 * build died at the page composer, the one agent whose schema contains a
 * union (the recursive block tree). `anyOf` is the supported spelling and is
 * equivalent here: the union is discriminated by `type`, so at most one branch
 * can ever match.
 *
 * Runs over the whole document, including `$defs`, because the block tree's
 * union lives behind a `$ref` rather than at the root.
 */
export function toOpenAiJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toOpenAiJsonSchema);
  if (!value || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    // `$schema` is metadata OpenAI has no use for and has historically
    // rejected on some model families; drop it rather than gamble.
    if (key === "$schema") continue;
    out[key === "oneOf" ? "anyOf" : key] = toOpenAiJsonSchema(child);
  }
  return out;
}

/**
 * @param strict OpenAI's strict structured-output mode requires EVERY property
 * to appear in the schema's `required` array. That is fine for the flat,
 * fully-required agent schemas, but the page composer's block tree is a
 * recursive union with many genuinely optional fields (`style`, `columns`,
 * `scale`, …); under `strict: true` the API rejects it outright with a 400,
 * failing every build. Those chains opt out and rely on zod parsing the
 * response instead — and `coerceBlocks` re-validates on the write path
 * regardless, so nothing unvalidated is ever persisted.
 *
 * Non-strict chains also hand OpenAI a hand-converted, sanitized JSON Schema
 * rather than the zod object, so `toOpenAiJsonSchema` above can fix up what
 * zod emits. That means LangChain no longer parses the response for us, so
 * the chain re-parses with the original zod schema itself — callers still
 * get a validated, correctly typed result either way.
 */
function structuredChain<T extends z.ZodType>(
  llm: ChatOpenAI,
  schema: T,
  name: string,
  system: string,
  human: string,
  strict = true,
  responseSchema?: z.ZodType
) {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", human],
  ]);

  if (strict) {
    return RunnableSequence.from([prompt, llm.withStructuredOutput(schema, { name, strict: true })]);
  }

  const jsonSchema = toOpenAiJsonSchema(toJsonSchema(schema)) as Record<string, unknown>;
  const structured = llm.withStructuredOutput(jsonSchema, { name, strict: false });
  const parser = responseSchema ?? schema;
  return RunnableSequence.from([prompt, structured, (raw: unknown) => parser.parse(raw)]);
}

/** Renders a direction's locked fields as an instruction block every layout-facing agent shares. */
function directionBrief(direction: ArtDirection): string {
  return (
    `Visual direction: "${direction.name}".\n` +
    `Mood: ${direction.mood}\n` +
    `Locked layout — do not deviate from these: navbar=${direction.navbar}, hero=${direction.hero}, ` +
    `welcome=${direction.welcome}, about=${direction.about}, sermons=${direction.sermons}, events=${direction.events}.`
  );
}

/**
 * One client per role, not one shared client for all six.
 *
 * Each agent resolves its own model name through `modelForRole()` — every
 * role defaults to the same "gpt-4o-mini" that used to be hardcoded here, so
 * behavior is unchanged until an `AI_MODEL_<ROLE>` env var opts a specific
 * agent into a different OpenAI model — a stronger one for the copywriter,
 * say, while the rest stay on the small default.
 *
 * Temperature stays grouped by task, same as before: schema-bearing agents
 * (producer, layout, QA, media) run cooler so structured output parses
 * reliably; the theme director and copywriter are pure prose with no enums to
 * get right, and run warmer so two churches given the same locked direction
 * don't read like the same paragraph with the name swapped.
 */
export function createChurchAgents(gateway: Gateway) {
  const producerLlm = buildRoleLlm(gateway, "producer", 0.55);
  const themeLlm = buildRoleLlm(gateway, "themeDirector", 0.8);
  const qaLlm = buildRoleLlm(gateway, "responsiveQa", 0.55);
  const mediaLlm = buildRoleLlm(gateway, "mediaDirector", 0.55);

  const producer = structuredChain(
    producerLlm,
    producerBriefSchema,
    "church_producer_brief",
    "You are the executive producer of a premium church website studio. " +
      "A visual direction has already been chosen for this build — your job is to brief the crew on " +
      "how THIS specific church fits that direction, not to invent a different one. " +
      "Ground everything in the church's actual profile (denomination, city, worship style, mission, values) " +
      "rather than generic church-website language. " +
      "Never invent miracles, addresses, or phone numbers.",
    "Direction:\n{direction}\n\nChurch profile:\n{profile}\n\nWrite a short production brief for the design crew."
  );

  const themeDirector = structuredChain(
    themeLlm,
    themeBriefSchema,
    "church_theme_director",
    "You are art director for church websites. The visual direction and its layout are already " +
      "decided — your job is describing how that direction should feel for THIS church specifically. " +
      "Reference real details from the profile (worship style, denomination, congregation size) in your " +
      "visualLanguage. Two churches given the same direction should read as two different, specific " +
      "answers, not the same paragraph with the name swapped. " +
      "mobileNotes and gridNotes should be concrete enough that a designer could act on them without " +
      "asking a follow-up question.",
    "Direction:\n{direction}\n\nProducer brief:\n{brief}\n\nChurch profile:\n{profile}\n\nDescribe how this direction fits this church."
  );

  // Producer + art director in one call. Runs at temperature 0.7 — between
  // the 0.55 the producer used and the 0.8 the theme director used, because
  // one response now carries both the grounded brief and the prose that has
  // to differ church to church.
  const creativeLlm = buildRoleLlm(gateway, "creativeDirector", 0.7);
  const creativeDirector = structuredChain(
    creativeLlm,
    creativeBriefSchema,
    "church_creative_brief",
    "You are the executive producer AND art director of a premium church website studio. " +
      "A visual direction has already been chosen for this build — your job is to brief the crew on " +
      "how THIS specific church fits that direction, not to invent a different one. " +
      "Ground everything in the church's actual profile (denomination, city, worship style, mission, values) " +
      "rather than generic church-website language. " +
      "Never invent miracles, addresses, or phone numbers. " +
      "churchArchetype, designGoal and mustInclude are the production brief. " +
      "visualLanguage describes how the chosen direction should FEEL for this church specifically — " +
      "reference real details from the profile (worship style, denomination, congregation size). Two " +
      "churches given the same direction should read as two different, specific answers, not the same " +
      "paragraph with the name swapped. " +
      "mobileNotes and gridNotes should be concrete enough that a designer could act on them without " +
      "asking a follow-up question.",
    "Direction:\n{direction}\n\nChurch profile:\n{profile}\n\n" +
      "Write the production brief and the art direction for this church."
  );

  const composerLlm = buildRoleLlm(gateway, "composer", 0.6);
  const composer = structuredChain(
    composerLlm,
    pageComposerSchema,
    "church_page_composer",
    "You compose a church homepage as a tree of generic layout BLOCKS — not a fixed template. " +
      "Block types: section (top-level band; children), stack (vertical group; children), " +
      "row (responsive multi-column group, set columns 1-4; children), spacer (size), " +
      "heading (text, scale: display/h1/h2/h3), text (text), eyebrow (text, accent: none/line/bordered/numbered), " +
      "image (leave src/videoSrc empty — the church adds real photos later; set treatment: rounded/square/framed " +
      "and aspect: square/video/portrait/wide/cinema so the empty slot still composes correctly), " +
      "button (label, href — one of /contact /about /sermons /events /giving, emphasis: primary/secondary/outline), " +
      "stats (2-3 label/value pairs). " +
      "Data-bound blocks render REAL church data and take no text from you — use them, never invent " +
      "sermon titles, event dates, ministry names, or contact details: navLinks, brandLogo, " +
      "sermonCollection (layout: grid/list/featured), eventCollection (layout: grid/list/calendar), " +
      "contactInfo, givingCta, socialLinks, copyrightLine. " +
      "ministryCollection is the one exception — ministries have no database, so YOU write its `items` " +
      "(3-4 entries of name + description) based on this church's denomination, size, and stated values; " +
      "if you genuinely cannot tell what this church runs, omit items rather than guessing at specifics. " +
      "Every container/leaf block may carry a `style`: padding/gap (none..2xl), align (left/center/right), " +
      "width (narrow/normal/wide/full), background (transparent/surface/primary/accent/inverted), " +
      "textTone (default/muted/inverted/accent). Vary these deliberately band to band — the whole point is " +
      "that this page should NOT read as one fixed template; alternate alignment, density, background, and " +
      "eyebrow accent across bands the way the mood description calls for. " +
      "Structure REQUIRED: the FIRST top-level block MUST be a section block whose id is exactly \"nav\", " +
      "containing a row with a brandLogo and a navLinks block. The LAST top-level block MUST be a section " +
      "block whose id is exactly \"footer\", containing a row with a copyrightLine and a navLinks block. " +
      "Between them: a hero band (eyebrow, heading, text, " +
      "button, optionally stats and an image), a welcome/about band, then ONE band per feature that is ON in " +
      "the profile (sermonCollection if sermons, eventCollection if events, ministryCollection if ministries, " +
      "givingCta if giving, contactInfo+socialLinks if contact), then a closing cta band (heading, text, button). " +
      "8-14 top-level blocks total, including nav and footer.",
    "Direction:\n{direction}\n\nProducer brief:\n{brief}\n\nTheme:\n{theme}\n\nChurch profile:\n{profile}\n\n" +
      "Copy voice: {copyVoice}\n\nCompose the homepage.",
    // Recursive block-tree schema with optional fields — see `structuredChain`.
    false,
    // ...and read the reply back leniently — see `pageComposerResponseSchema`.
    pageComposerResponseSchema
  );

  const responsiveQa = structuredChain(
    qaLlm,
    qaReportSchema,
    "church_responsive_qa",
    "You are editorial QA for a church website on mobile (390px), tablet (768px), and desktop. " +
      "The layout and hero/navbar treatment are already fixed and already legibility-checked — do not " +
      "flag or change them. Your job is catching real problems in what actually varies: copy that reads " +
      "generic instead of specific to this church, a headline too long to read on a phone in one glance, " +
      "ministries or stats that feel like filler, or a mismatch between the stated mood and the actual " +
      "words used. " +
      "Approve only when the copy is genuinely specific to this church and reads well at 390px width. " +
      "mobileFeedback: 2-5 concrete notes on copy length, tap-target spacing, and stack order on a phone. " +
      "designFeedback: 2-5 notes on whether the words match the intended mood and where they don't. " +
      "variantFixes should almost always be empty — only use it if a section type is missing that the " +
      "profile's features require.",
    "Direction:\n{direction}\n\nTheme:\n{theme}\n\nLayout:\n{layout}\n\nCopy:\n{copy}\n\nFeatures:\n{features}\n\n" +
      "Audit this plan for specificity, mobile readability, and mood fit."
  );

  const mediaDirector = structuredChain(
    mediaLlm,
    mediaPlanSchema,
    "church_media_director",
    "You are media director. Do NOT generate or invent images. " +
      "Photo slots stay empty until the church uploads their own photos. " +
      "Write a clear checklist of improvements asking them to provide real images " +
      "(always include upload_hero_photo; also welcome/about/event photos when relevant). " +
      "Include at least one mobile-related action " +
      "(fix_mobile_hero, fix_mobile_nav, or tighten_mobile_type).",
    "Direction:\n{direction}\n\nChurch profile:\n{profile}\n\nLayout types: {types}\n\nList media todos for the church to provide."
  );

  return {
    producer,
    themeDirector,
    creativeDirector,
    composer,
    responsiveQa,
    mediaDirector,
  };
}

export type ChurchAgents = ReturnType<typeof createChurchAgents>;

function directionForPrompt(direction: ArtDirection): string {
  return directionBrief(direction);
}

export async function runProducer(
  agents: ChurchAgents,
  profile: string,
  direction: ArtDirection
): Promise<ProducerBrief> {
  return agents.producer.invoke({
    profile,
    direction: directionForPrompt(direction),
  }) as Promise<ProducerBrief>;
}

export async function runThemeDirector(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  direction: ArtDirection
): Promise<ThemeBrief> {
  return agents.themeDirector.invoke({
    profile,
    brief: JSON.stringify(brief),
    direction: directionForPrompt(direction),
  }) as Promise<ThemeBrief>;
}

/**
 * The producer brief and the theme brief in one round trip. Returns both
 * shapes' fields, so `ProducerBrief` and `ThemeBrief` consumers can each take
 * the same object.
 */
export async function runCreativeDirector(
  agents: ChurchAgents,
  profile: string,
  direction: ArtDirection
): Promise<CreativeBrief> {
  return agents.creativeDirector.invoke({
    profile,
    direction: directionForPrompt(direction),
  }) as Promise<CreativeBrief>;
}

export async function runComposer(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  theme: ThemeBrief,
  direction: ArtDirection
): Promise<PageComposerOutput> {
  return agents.composer.invoke({
    profile,
    brief: JSON.stringify(brief),
    theme: JSON.stringify(theme),
    direction: directionForPrompt(direction),
    copyVoice: direction.copyVoice,
  }) as Promise<PageComposerOutput>;
}

export async function runResponsiveQa(
  agents: ChurchAgents,
  theme: ThemeBrief,
  layout: unknown,
  copy: unknown,
  features: string,
  direction: ArtDirection
): Promise<QaReport> {
  return agents.responsiveQa.invoke({
    theme: JSON.stringify(theme),
    layout: JSON.stringify(layout),
    copy: JSON.stringify(copy),
    features,
    direction: directionForPrompt(direction),
  }) as Promise<QaReport>;
}

export async function runMediaDirector(
  agents: ChurchAgents,
  profile: string,
  types: string,
  direction: ArtDirection
): Promise<MediaPlan> {
  return agents.mediaDirector.invoke({
    profile,
    types,
    direction: directionForPrompt(direction),
  }) as Promise<MediaPlan>;
}
