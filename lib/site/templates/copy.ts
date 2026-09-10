import { firstSentence, resolveHeroCopy, type HeroCopy } from "@/lib/site/blocks/hero";
import type { TemplateProfile } from "./types";

/**
 * The words, resolved once for all three templates.
 *
 * Every slot prefers something the church actually told us and falls back to a
 * sentence that is true of any congregation. Two rules govern the fallbacks:
 *
 * - **Never invent a fact.** No attendance figures, no founding year, no
 *   claim about what this church believes. `ensureRequiredBands` follows the
 *   same rule for the band it synthesizes, and `default-pages.ts` says it
 *   outright.
 * - **Never leave a slot empty.** A church that skipped the optional wizard
 *   fields must still get a finished page, not a band with a heading and a
 *   gap under it. That is the whole difference between a fallback and an
 *   omission, and it is why these live here rather than as `?? ""`.
 *
 * The headings are NOT here. Those are where the three templates differ in
 * voice, so each authors its own.
 */
export type TemplateCopy = {
  hero: HeroCopy;
  /** The narrative band: who gathers here. */
  aboutBody: string;
  /** When and how to turn up. */
  visitBody: string;
  /** The closing call to action. */
  closingBody: string;
  givingBody: string;
  contactBody: string;
  ministriesBody: string;
  /** The church's stated values, when they gave any. */
  valuesBody?: string;
  seoDescription: string;
};

/** What is left of a paragraph once its opening sentence has been used elsewhere. */
function remainderAfterFirstSentence(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  const opening = firstSentence(trimmed);
  if (!trimmed || !opening) return trimmed;
  const rest = trimmed.slice(opening.length).trim();
  return rest || undefined;
}

/** `"a b"` from the parts that exist, with no dangling separator. */
function sentence(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" ");
}

export function resolveTemplateCopy(
  profile: TemplateProfile,
  overrides: { ctaLabel?: string } = {}
): TemplateCopy {
  const { churchName, tagline, story, features } = profile;

  /**
   * Service times beat the mission statement in the subhead.
   *
   * `resolveHeroCopy`'s own fallback reaches for the mission, which is also
   * what the narrative band below the hero is built from — so a church that
   * wrote one good sentence saw it twice inside the first two screens. When
   * the church gave us times, that is both the more useful answer under a
   * headline and the one that does not repeat.
   */
  const hero = resolveHeroCopy(
    { ctaLabel: overrides.ctaLabel, subhead: story.serviceTimes },
    {
      churchName,
      tagline,
      story: { mission: story.mission, values: story.values },
      hasContactPage: features.contact,
    }
  );

  /** Whether the hero fell back to the mission, and the about band must move off it. */
  const heroTookMission =
    !story.serviceTimes?.trim() && Boolean(story.mission?.trim()) &&
    hero.subhead === firstSentence(story.mission);

  /**
   * `resolveHeroCopy` is allowed to return an empty subhead — the AI path
   * drops the node entirely rather than render a blank line. A template has no
   * model to blame for a missing sentence, so it fills it instead.
   */
  if (!hero.subhead) {
    hero.subhead =
      story.serviceTimes?.trim() ||
      sentence([
        "A church",
        story.city ? `in ${story.city},` : undefined,
        "gathering every Sunday.",
      ]);
  }

  /**
   * The rest of the mission when the hero took its opening sentence, the whole
   * of it otherwise. A church that wrote a single sentence and no times gets
   * its values here instead of the same line twice.
   */
  const missionRemainder = heroTookMission ? remainderAfterFirstSentence(story.mission) : story.mission;

  const aboutBody =
    missionRemainder?.trim() ||
    story.values?.trim() ||
    tagline ||
    `${churchName} is a community that gathers to worship, to learn, and to look after one another.`;

  const visitBody =
    story.serviceTimes?.trim() ||
    sentence([
      "We gather every Sunday",
      story.city ? `in ${story.city}` : undefined,
      "— come as you are, and stay for coffee afterwards.",
    ]);

  const closingBody = sentence([
    story.city ? `Find us in ${story.city}.` : "We would love to meet you.",
    "Whether it is your first Sunday or your fiftieth, there is a seat for you.",
  ]);

  return {
    hero,
    aboutBody,
    visitBody,
    closingBody,
    /**
     * Dropped when the about band already fell back to it — otherwise a
     * church that wrote values but no mission reads the same line twice, once
     * under "The story so far" and again under "What we hold to".
     */
    valuesBody:
      story.values?.trim() && story.values.trim() !== aboutBody
        ? story.values.trim()
        : undefined,
    givingBody:
      "Your giving pays for the things this church does the rest of the week — for our neighbours, and for the people who will walk in next Sunday.",
    contactBody: sentence([
      story.pastorName ? `${story.pastorName} and the team` : "We",
      "would be glad to hear from you — about a visit, a question, or anything at all.",
    ]),
    ministriesBody:
      "There is more happening here than Sunday morning. These are the groups and teams you can join.",
    seoDescription:
      firstSentence(story.mission) ||
      tagline ||
      `${churchName} — worship, sermons and events. Everyone is welcome.`,
  };
}
