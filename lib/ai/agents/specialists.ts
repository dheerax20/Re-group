import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import {
  copyDeckSchema,
  layoutPlanSchema,
  mediaPlanSchema,
  producerBriefSchema,
  qaReportSchema,
  themeBriefSchema,
  type CopyDeck,
  type LayoutPlan,
  type MediaPlan,
  type ProducerBrief,
  type QaReport,
  type ThemeBrief,
} from "./schemas";
import type { ArtDirection } from "./catalog";
import { buildRoleLlm, type Gateway } from "./model-config";

function structuredChain<T extends z.ZodType>(
  llm: ChatOpenAI,
  schema: T,
  name: string,
  system: string,
  human: string
) {
  const structured = llm.withStructuredOutput(schema, {
    name,
    strict: true,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", human],
  ]);
  return RunnableSequence.from([prompt, structured]);
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
  const layoutLlm = buildRoleLlm(gateway, "layoutArchitect", 0.55);
  const copywriterLlm = buildRoleLlm(gateway, "copywriter", 0.8);
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

  const layoutArchitect = structuredChain(
    layoutLlm,
    layoutPlanSchema,
    "church_layout_architect",
    "You sequence a church homepage. " +
      "The look of navbar, hero, welcome, about, sermons, and events is already fixed — restate exactly " +
      "the variant given to you for each of those types; do not substitute a different one. " +
      "Your real job is everything else: which of the church's enabled optional sections " +
      "(ministries, giving, youtube, podcast, contact) appear, and in what order between 'about' and 'cta'. " +
      "Order by what a first-time visitor most needs next — a church that leads with community should put " +
      "ministries early; a giving-forward moment usually reads better late, right before the closing cta. " +
      "Structure: navbar first, footer last, cta second-to-last. Only include a section type whose feature " +
      "is confirmed on in the profile. " +
      "Use ONLY these variants (already assigned per type; do not invent a new one):\n{variants}",
    "Direction:\n{direction}\n\nProducer brief:\n{brief}\n\nTheme:\n{theme}\n\nChurch profile:\n{profile}\n\nOutput the section plan."
  );

  const copywriter = structuredChain(
    copywriterLlm,
    copyDeckSchema,
    "church_copywriter",
    "You write website copy for one specific church, in the voice given to you — never generic " +
      "church-website boilerplate. " +
      "Use at least two concrete details from the church profile (city, worship style, pastor's name, " +
      "mission, values, denomination) somewhere in the copy — a headline, a description, or a stat. " +
      "Never reuse these overused phrases: 'a place to belong', 'join us this Sunday', 'come as you are', " +
      "'we'd love to meet you' — say the same thing in this church's own words instead. " +
      "Short headlines that work on a phone (under ~8 words when possible). " +
      "Never invent contact details. " +
      "CTA hrefs: /contact, /about, /sermons, /events, /giving only. " +
      "Every section object MUST include eyebrow, title, description, ctaLabel, ctaHref — use '' if unused.",
    "Direction:\n{direction}\n\nCopy voice: {copyVoice}\n\nProducer brief:\n{brief}\n\nTheme:\n{theme}\n\n" +
      "Layout types: {types}\n\nChurch profile:\n{profile}\n\nWrite the copy deck."
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

  return { producer, themeDirector, layoutArchitect, copywriter, responsiveQa, mediaDirector };
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

export async function runLayoutArchitect(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  theme: ThemeBrief,
  direction: ArtDirection
): Promise<LayoutPlan> {
  return agents.layoutArchitect.invoke({
    profile,
    brief: JSON.stringify(brief),
    theme: JSON.stringify(theme),
    direction: directionForPrompt(direction),
    variants:
      `navbar: ${direction.navbar}\nhero: ${direction.hero}\nwelcome: ${direction.welcome}\n` +
      `about: ${direction.about}\nsermons: ${direction.sermons}\nevents: ${direction.events}\n` +
      "ministries: grid\ngiving: centered\nyoutube: featured\npodcast: featured\ncontact: standard\n" +
      "cta: full-width\nfooter: standard",
  }) as Promise<LayoutPlan>;
}

export async function runCopywriter(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  theme: ThemeBrief,
  layout: LayoutPlan,
  direction: ArtDirection
): Promise<CopyDeck> {
  return agents.copywriter.invoke({
    profile,
    brief: JSON.stringify(brief),
    theme: JSON.stringify(theme),
    types: layout.sections.map((s) => s.type).join(", "),
    direction: directionForPrompt(direction),
    copyVoice: direction.copyVoice,
  }) as Promise<CopyDeck>;
}

export async function runResponsiveQa(
  agents: ChurchAgents,
  theme: ThemeBrief,
  layout: LayoutPlan,
  copy: CopyDeck,
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
  layout: LayoutPlan,
  direction: ArtDirection
): Promise<MediaPlan> {
  return agents.mediaDirector.invoke({
    profile,
    types: layout.sections.map((s) => s.type).join(", "),
    direction: directionForPrompt(direction),
  }) as Promise<MediaPlan>;
}
