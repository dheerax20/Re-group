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

/**
 * Renders a direction as an instruction block every layout-facing agent shares.
 *
 * Briefed in block-recipe terms. It used to end with "Locked layout — do not
 * deviate from these: navbar=transparent, hero=cinematic, …", naming section
 * components that were deleted with the section layer — so the model spent
 * instruction budget on a vocabulary that could not reach the page, and the
 * only fields that actually landed were `mood` and `copyVoice`.
 *
 * What the recipe decides is stated as already-decided rather than as an
 * instruction, because it is: `applyDesignPass` assigns it after the model
 * replies. Telling the composer to produce it as well would only invite it to
 * emit styling that gets discarded.
 */
function directionBrief(direction: ArtDirection): string {
  const { recipe } = direction;
  return (
    `Visual direction: "${direction.name}".\n` +
    `Mood: ${direction.mood}\n` +
    // No hero line. The hero band is built from the `hero` copy object by
    // `buildHeroBand`, not composed — describing its shape here would only
    // invite the model to build a second one.
    `Already decided for you (do not restate or fight it): ` +
    `${recipe.alignPolicy === "left" ? "bands ranged left throughout" : recipe.alignPolicy === "alternating" ? "alignment alternating band to band" : "a centred closing band with the rest ranged left"}, ` +
    `sermons as a ${recipe.sermons}, events as a ${recipe.events}, ` +
    `${recipe.eyebrows === "none" ? "no eyebrows anywhere" : "at most one eyebrow on the page"}.`
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
      "Do not reach for the looks that every generated site already has: a cream ground with a " +
      "high-contrast display serif and a terracotta accent, near-black with a single acid accent, or " +
      "broadsheet hairline rules. Name what is specific to THIS congregation instead. " +
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
      "image (leave src/videoSrc empty — the church adds real photos later; its shape is assigned for you), " +
      "button (label, href — one of /contact /about /sermons /events /giving, emphasis: primary/secondary/outline), " +
      "stats (2-3 label/value pairs). " +
      "Data-bound blocks render REAL church data and take no text from you — use them, never invent " +
      "sermon titles, event dates, ministry names, or contact details: navLinks, brandLogo, " +
      "sermonCollection, eventCollection (their layouts are assigned for you), " +
      "contactInfo, givingCta, socialLinks, copyrightLine. " +
      "ministryCollection is the one exception — ministries have no database, so YOU write its `items` " +
      "(3-4 entries of name + description) based on this church's denomination, size, and stated values; " +
      "if you genuinely cannot tell what this church runs, omit items rather than guessing at specifics. " +
      "STYLING IS NOT YOUR JOB. Band padding, background, alignment, width, the nav bar's height and " +
      "each collection's layout are all assigned after you by the design template for this build — " +
      "anything you set for them is discarded. Do not emit `style` at all. Spend the whole reply on the " +
      "two things only you can decide: WHICH blocks tell this church's story, and the WORDS in them. " +
      "THE HERO IS A THESIS. Open on the most characteristic TRUE thing about this specific church — the " +
      "neighbourhood it sits in, what actually happens on a Sunday morning, who gathers, the year it was " +
      "founded, what it is known for locally. A decontextualised scripture line over a stock welcome " +
      "sentence is the answer a generator gives for every church on earth; it says nothing, and a visitor " +
      "learns nothing from it. If the profile gives you a real detail, lead with it. " +
      "AVOID THE HOUSE STYLE OF GENERATED SITES. Three looks read as machine-made on sight: a cream ground " +
      "with a high-contrast display serif and a terracotta accent; near-black with one acid accent; and " +
      "broadsheet hairline rules with square corners. Where the direction leaves something to you, do not " +
      "spend it on one of those. " +
      "STRUCTURE MUST CARRY INFORMATION, never decorate. Specifically: do NOT put an `eyebrow` above every " +
      "band — the heading carries its own weight, and a small tracked-out label above each one is the " +
      "single clearest tell that a page was assembled rather than written. At most ONE eyebrow on the " +
      "page, and only if it says something the heading does not. `accent: \"numbered\"` only where the " +
      "bands genuinely are a sequence the reader must follow in order. Do not use `stats` as hero " +
      "decoration — a big number with a small label under it is a template, and invented attendance or " +
      "founding figures are worse than no figures; use it only for numbers the profile actually gives you. " +
      "Do not build the page out of three identical cards. " +
      "WRITE LIKE A PERSON. Active voice, second person — talk TO the visitor. Be specific rather than " +
      "clever. A button names the action it performs: \"Plan Your Visit\", \"Watch Sunday's Sermon\", " +
      "\"Find a Service Time\". \"Learn More\", \"Get Involved\" and \"Discover\" are banned — they tell " +
      "the visitor nothing about where they are going. " +
      "THE HERO COPY IS THREE STRINGS AND EACH HAS TO EARN ITS PLACE. `headline` names something true " +
      "about THIS church — who gathers, where, what it is like to walk in — and is NEVER a bare " +
      "scripture quotation, which fits every church and therefore describes none. `subhead` never opens " +
      "with \"Welcome to <church name>, where...\"; it adds a second fact, not a restatement of the " +
      "first. `ctaLabel` names the action the visitor is about to take — \"Plan your visit\", \"Find a " +
      "service time\", \"Meet our pastor\" — and is never \"Learn More\", \"Get Started\", " +
      "\"Discover More\" or \"Click Here\". " +
      "THE HERO IS NOT YOURS TO BUILD. You write it as the `hero` object — four short fields, nothing " +
      "else — and the design template composes the band around a photograph you never see. Do NOT emit a " +
      "hero band in `blocks`, and do NOT give any block the id \"hero\"; one will be discarded. " +
      "Structure REQUIRED: the FIRST top-level block MUST be a section block whose id is exactly \"nav\", " +
      "containing a row with a brandLogo and a navLinks block. The LAST top-level block MUST be a section " +
      "block whose id is exactly \"footer\", containing a row with a copyrightLine and a navLinks block. " +
      "Between them, STARTING with the welcome/about band: a welcome/about band, then " +
      "ONE band per feature that is ON in the profile (sermonCollection if sermons, eventCollection if " +
      "events, ministryCollection if ministries, givingCta if giving, contactInfo+socialLinks if contact), " +
      "then a closing cta band (heading, text, button). Every feature band needs its own `heading` saying " +
      "what it is. " +
      "The feature bands are NOT optional: the site's navigation links to every one of those pages, so a " +
      "homepage that omits a band for an enabled feature is broken — the visitor is told the church has " +
      "sermons and then shown a page that never mentions them. Include every one whose flag is true. " +
      "7-13 top-level blocks total, including nav and footer.",
    /**
     * `Copy voice` leads. It used to sit at the very bottom, below four blocks
     * of context including two dense JSON blobs, which is the worst place to
     * put the one instruction that governs every word of the reply.
     *
     * `Theme:` is gone: `crew.ts` sets `const theme = brief` and passed the
     * same object into both slots, so the model read `churchArchetype`,
     * `designGoal`, `mustInclude`, `visualLanguage`, `mobileNotes` and
     * `gridNotes` twice — paying for the tokens and diluting both copies.
     */
    "Copy voice: {copyVoice}\n\nDirection:\n{direction}\n\nBrief:\n{brief}\n\n" +
      "Church profile:\n{profile}\n\nCompose the homepage.",
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
    "You are media director. Do NOT generate or invent images, and never write an image URL. " +
      "The hero ALREADY shows a stock photograph, and so may the welcome band — your job is asking the " +
      "church to replace them with their own. Say what makes a good replacement (a wide crop, taken in " +
      "daylight, people visible, their actual building or congregation) rather than just \"upload a " +
      "photo\". Every other photo slot stays empty until they upload something. " +
      "Write a clear checklist of improvements " +
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

/**
 * No `theme` parameter: `crew.ts` set `const theme = brief` and passed the same
 * object twice, so the composer read every field of the creative brief in two
 * places — paying for the tokens and diluting both copies.
 */
export async function runComposer(
  agents: ChurchAgents,
  profile: string,
  brief: CreativeBrief,
  direction: ArtDirection
): Promise<PageComposerOutput> {
  return agents.composer.invoke({
    profile,
    brief: JSON.stringify(brief),
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
