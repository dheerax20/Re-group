import type { GeneratedSiteConfig, SiteGenerationInput, SiteGenerationProvider } from "@/lib/ai/types";
import { assembleGeneratedBlocks } from "./assemble";
import { artDirectionByName, pickArtDirection, profileForAgents, type ArtDirection } from "./catalog";
import {
  createChurchAgents,
  runComposer,
  runCreativeDirector,
  runMediaDirector,
  runResponsiveQa,
} from "./specialists";
import type { AgentLogEntry, DesignFeedback, SiteImprovement } from "./schemas";
import { resolveGateway, type Gateway } from "./model-config";

export type ChurchWebsiteBuild = GeneratedSiteConfig & {
  log: AgentLogEntry[];
  styleName: string;
  improvements: SiteImprovement[];
  designFeedback: DesignFeedback[];
  mobileFeedback: DesignFeedback[];
};

/** The crew's steps, in run order. The client's progress list reads this. */
export const CREW_STEPS = [
  { id: "producer", label: "Producer", detail: "Church story & creative brief" },
  { id: "theme-director", label: "Art director", detail: "Visual direction & mobile grid" },
  { id: "layout-architect", label: "Composer", detail: "AI-generated page layout & copy" },
  { id: "copywriter", label: "SEO", detail: "Page title & description" },
  { id: "media-director", label: "Media checklist", detail: "What photos you should provide" },
  { id: "responsive-qa", label: "Design QA", detail: "Mobile + aesthetic review" },
] as const;

export type CrewStepId = (typeof CREW_STEPS)[number]["id"];

/**
 * Called as each specialist finishes. The job runner persists this, which is
 * what makes the progress the user sees real rather than a timer.
 */
export type CrewProgress = (step: {
  id: CrewStepId;
  index: number;
  total: number;
}) => void | Promise<void>;

/**
 * The bands the composer is about to produce, as a plain list.
 *
 * The media director wants to know roughly what the page will contain so it
 * can ask for the right photos ("a welcome photo", "event photos"). That is
 * fully determined before the composer runs: the art direction locks the
 * fixed bands, and the feature flags decide the optional ones. Deriving it
 * here instead of reading it off the composed tree is what lets the media
 * director run concurrently rather than waiting a whole round trip for a
 * list nobody needed the model to compute.
 */
function plannedBandTypes(input: SiteGenerationInput, direction: ArtDirection): string {
  const features = input.features;
  const bands = [
    "nav",
    `hero (${direction.hero})`,
    `welcome (${direction.welcome})`,
    `about (${direction.about})`,
    features?.sermons ? `sermons (${direction.sermons})` : null,
    features?.events ? `events (${direction.events})` : null,
    features?.ministries ? "ministries" : null,
    features?.giving ? "giving" : null,
    features?.youtube ? "youtube" : null,
    features?.podcast ? "podcast" : null,
    features?.contact ? "contact" : null,
    "cta",
    "footer",
  ];
  return bands.filter(Boolean).join(", ");
}

function stepIndex(id: CrewStepId): number {
  return CREW_STEPS.findIndex((step) => step.id === id);
}

/**
 * Multi-agent LangChain crew that builds an aesthetic church website.
 * Does not select stock catalog templates — invents layout/copy/media.
 */
export class ChurchWebsiteCrew implements SiteGenerationProvider {
  constructor(private readonly gateway: Gateway | null = resolveGateway()) {}

  async generateSiteConfig(input: SiteGenerationInput): Promise<GeneratedSiteConfig> {
    const built = await this.build(input);
    return {
      sections: built.sections,
      blocks: built.blocks,
      navigation: built.navigation,
      seo: built.seo,
    };
  }

  /**
   * @param previousStyleName The `styleName` from this site's last build, if
   * any — passed straight through from the stored site record. Used only to
   * pick a genuinely different `ArtDirection` this time; the crew never sees
   * or reasons about the previous build's content otherwise.
   */
  async build(
    input: SiteGenerationInput,
    onProgress?: CrewProgress,
    previousStyleName?: string
  ): Promise<ChurchWebsiteBuild> {
    if (!this.gateway) {
      throw new Error(
        "No AI provider is configured: set OPENAI_API_KEY."
      );
    }

    const total = CREW_STEPS.length;
    const report = async (id: CrewStepId) => {
      // Progress reporting must never fail a build that is otherwise fine.
      try {
        await onProgress?.({ id, index: stepIndex(id), total });
      } catch (error) {
        console.error(`[crew] progress report failed at "${id}"`, error);
      }
    };

    // Chosen once, up front — every agent below is briefed on the same fixed
    // direction rather than each independently guessing at a "premium" look
    // and converging on whichever one the training data rewards most.
    const direction = pickArtDirection(artDirectionByName(previousStyleName)?.id);

    const log: AgentLogEntry[] = [];
    const agents = createChurchAgents(this.gateway);
    const profile = profileForAgents(input);

    // The media director only ever needed the church profile, the direction,
    // and a rough idea of which bands the page will have — none of which come
    // out of the composer. It used to wait for the composed tree anyway, which
    // put a whole extra round trip on the critical path for a photo checklist.
    // Now it runs alongside everything else and is awaited at the end.
    const mediaPromise = runMediaDirector(agents, profile, plannedBandTypes(input, direction), direction);
    // Nothing awaits this until the very end; without a handler now, a rejection
    // in the meantime is an unhandled promise rejection that can kill the process
    // before the `await` below ever gets to catch it.
    mediaPromise.catch(() => {});

    // Producer brief + art direction in ONE call. These were two agents where
    // the second one's only input was the first one's output — a full round
    // trip for a handoff the model does internally anyway.
    await report("producer");
    const brief = await runCreativeDirector(agents, profile, direction);
    log.push({
      agent: "producer",
      role: "Executive producer",
      summary: `${brief.churchArchetype}. ${brief.designGoal}`,
    });

    await report("theme-director");
    // Same object: `creativeBriefSchema` is the producer's fields plus the
    // theme director's, so `brief` satisfies both consumers.
    const theme = brief;
    log.push({
      agent: "theme-director",
      role: "Art director",
      summary: `${direction.name} · ${direction.hero} hero`,
    });

    // The page composer writes the homepage directly as a block tree — one
    // agent doing what used to be layout-architect + copywriter, since in a
    // generic block tree, layout and copy are the same act.
    await report("layout-architect");
    const composed = await runComposer(agents, profile, brief, theme, direction);
    log.push({
      agent: "layout-architect",
      role: "Page composer",
      // `rationale` is prose the model can simply omit (see
      // `pageComposerResponseSchema`); an empty row in the church's build log
      // reads like the step silently did nothing.
      summary: composed.rationale || `Composed a ${direction.name} homepage.`,
    });

    await report("copywriter");
    const media = await mediaPromise;
    log.push({
      agent: "copywriter",
      role: "Church copywriter",
      summary: composed.seoTitle,
    });
    log.push({
      agent: "media-director",
      role: "Media planner",
      summary: `Ask church for photos · ${media.improvements.length} media todos`,
    });

    await report("responsive-qa");
    const qa = await runResponsiveQa(
      agents,
      theme,
      composed.blocks,
      { seoTitle: composed.seoTitle, seoDescription: composed.seoDescription },
      JSON.stringify(input.features),
      direction
    );
    log.push({
      agent: "responsive-qa",
      role: "Design & mobile QA",
      // QA is advisory on the composer path: its notes are surfaced to the
      // church as design/mobile feedback, not auto-applied. Don't claim a
      // patch was applied when nothing was changed.
      summary: qa.approved
        ? `Approved · ${qa.mobileFeedback.length} mobile notes`
        : qa.issues.slice(0, 2).join(" ") || `${qa.designFeedback.length} design notes to review`,
    });

    const assembled = assembleGeneratedBlocks({ input, composed });

    const improvements: SiteImprovement[] = [...media.improvements];
    if (!improvements.some((item) => item.action === "upload_hero_photo")) {
      improvements.unshift({
        title: "Add your hero photo",
        detail: "Upload a worship or sanctuary photo so the homepage feels like your church.",
        action: "upload_hero_photo",
      });
    }

    return {
      ...assembled,
      log,
      styleName: direction.name,
      improvements,
      designFeedback: qa.designFeedback,
      mobileFeedback: qa.mobileFeedback,
    };
  }
}
