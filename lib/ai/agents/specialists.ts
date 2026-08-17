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
import { variantCatalogForPrompt } from "./catalog";

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

export function createChurchAgents(apiKey: string, model = "gpt-4o-mini") {
  const llm = new ChatOpenAI({ apiKey, model, temperature: 0.45 });

  const producer = structuredChain(
    llm,
    producerBriefSchema,
    "church_producer_brief",
    "You are the executive producer of a premium church website studio. " +
      "You NEVER choose a stock catalog template. You brief a specialist crew to invent a unique, " +
      "aesthetic, photo-led homepage for this congregation. " +
      "Demand cinematic photography, clear hierarchy, and mobile-first spacing. " +
      "Never invent miracles, addresses, or phone numbers.",
    "Church profile:\n{profile}\n\nWrite a short production brief for the design crew."
  );

  const themeDirector = structuredChain(
    llm,
    themeBriefSchema,
    "church_theme_director",
    "You are art director for cinematic church websites. " +
      "heroTreatment MUST be cinematic or fullscreen (prefer cinematic). Use split only if the story is very editorial. " +
      "NEVER propose a plain grey or centered-on-empty-canvas look. " +
      "navbarTreatment MUST be transparent when the hero is a full-bleed photo. " +
      "Describe mobile: single column, 16px gutters, large tap targets, readable type at 390px width.",
    "Producer brief:\n{brief}\n\nChurch profile:\n{profile}\n\nCreate the visual brief."
  );

  const layoutArchitect = structuredChain(
    llm,
    layoutPlanSchema,
    "church_layout_architect",
    "You invent a unique church homepage sequence — not a catalog pick. " +
      "HARD RULES: " +
      "1) First = navbar (transparent). " +
      "2) Second = hero with variant cinematic OR fullscreen only. " +
      "3) Welcome = split (photo + story). " +
      "4) About = image-right or image-left. " +
      "5) Include cta + footer. " +
      "6) Only include sermons/events/ministries/giving/youtube/podcast/contact when that feature is true. " +
      "7) Prefer events=grid, sermons=cards for mobile. " +
      "Use ONLY these variants:\n{variants}",
    "Producer brief:\n{brief}\n\nTheme:\n{theme}\n\nChurch profile:\n{profile}\n\nOutput the section plan."
  );

  const copywriter = structuredChain(
    llm,
    copyDeckSchema,
    "church_copywriter",
    "You write aesthetic website copy for churches. Specific to this congregation. " +
      "Short headlines that work on a phone (under ~8 words when possible). " +
      "Avoid cliches unless you add a local detail. Never invent contact details. " +
      "CTA hrefs: /contact, /about, /sermons, /events, /giving only. " +
      "Every section object MUST include eyebrow, title, description, ctaLabel, ctaHref — use '' if unused.",
    "Producer brief:\n{brief}\n\nTheme:\n{theme}\n\nLayout types: {types}\n\nChurch profile:\n{profile}\n\nWrite the copy deck."
  );

  const responsiveQa = structuredChain(
    llm,
    qaReportSchema,
    "church_responsive_qa",
    "You are design QA for church websites on mobile (390px), tablet (768px), and desktop. " +
      "Reject flat grey heroes and centered-only text heroes — fix hero to cinematic/fullscreen. " +
      "Reject transparent navbar without a photo hero. " +
      "Approve only if navbar+hero+footer exist and feature flags match. " +
      "mobileFeedback: 2-5 concrete mobile UX notes (type size, stack order, CTA thumb reach, image crop). " +
      "designFeedback: 2-5 aesthetic improvements (contrast, photo quality, whitespace, hierarchy). " +
      "variantFixes must use ONLY:\n{variants}",
    "Theme:\n{theme}\n\nLayout:\n{layout}\n\nFeatures:\n{features}\n\nAudit this plan for beauty and mobile."
  );

  const mediaDirector = structuredChain(
    llm,
    mediaPlanSchema,
    "church_media_director",
    "You are media director. Do NOT generate or invent images. " +
      "Photo slots stay empty until the church uploads their own photos. " +
      "Write a clear checklist of improvements asking them to provide real images " +
      "(always include upload_hero_photo; also welcome/about/event photos when relevant). " +
      "Include at least one mobile-related action " +
      "(fix_mobile_hero, fix_mobile_nav, or tighten_mobile_type).",
    "Church profile:\n{profile}\n\nLayout types: {types}\n\nList media todos for the church to provide."
  );

  return { producer, themeDirector, layoutArchitect, copywriter, responsiveQa, mediaDirector };
}

export type ChurchAgents = ReturnType<typeof createChurchAgents>;

export async function runProducer(
  agents: ChurchAgents,
  profile: string
): Promise<ProducerBrief> {
  return agents.producer.invoke({ profile }) as Promise<ProducerBrief>;
}

export async function runThemeDirector(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief
): Promise<ThemeBrief> {
  return agents.themeDirector.invoke({
    profile,
    brief: JSON.stringify(brief),
  }) as Promise<ThemeBrief>;
}

export async function runLayoutArchitect(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  theme: ThemeBrief
): Promise<LayoutPlan> {
  return agents.layoutArchitect.invoke({
    profile,
    brief: JSON.stringify(brief),
    theme: JSON.stringify(theme),
    variants: variantCatalogForPrompt(),
  }) as Promise<LayoutPlan>;
}

export async function runCopywriter(
  agents: ChurchAgents,
  profile: string,
  brief: ProducerBrief,
  theme: ThemeBrief,
  layout: LayoutPlan
): Promise<CopyDeck> {
  return agents.copywriter.invoke({
    profile,
    brief: JSON.stringify(brief),
    theme: JSON.stringify(theme),
    types: layout.sections.map((s) => s.type).join(", "),
  }) as Promise<CopyDeck>;
}

export async function runResponsiveQa(
  agents: ChurchAgents,
  theme: ThemeBrief,
  layout: LayoutPlan,
  features: string
): Promise<QaReport> {
  return agents.responsiveQa.invoke({
    theme: JSON.stringify(theme),
    layout: JSON.stringify(layout),
    features,
    variants: variantCatalogForPrompt(),
  }) as Promise<QaReport>;
}

export async function runMediaDirector(
  agents: ChurchAgents,
  profile: string,
  layout: LayoutPlan
): Promise<MediaPlan> {
  return agents.mediaDirector.invoke({
    profile,
    types: layout.sections.map((s) => s.type).join(", "),
  }) as Promise<MediaPlan>;
}
