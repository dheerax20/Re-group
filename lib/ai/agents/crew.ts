import type { GeneratedSiteConfig, SiteGenerationInput, SiteGenerationProvider } from "@/lib/ai/types";
import { assembleGeneratedSite } from "./assemble";
import { artDirectionByName, pickArtDirection, profileForAgents } from "./catalog";
import {
  createChurchAgents,
  runCopywriter,
  runLayoutArchitect,
  runMediaDirector,
  runProducer,
  runResponsiveQa,
  runThemeDirector,
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
  { id: "layout-architect", label: "Layout", detail: "Unique section architecture" },
  { id: "copywriter", label: "Copywriter", detail: "Congregation-specific words" },
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

    await report("producer");
    const brief = await runProducer(agents, profile, direction);
    log.push({
      agent: "producer",
      role: "Executive producer",
      summary: `${brief.churchArchetype}. ${brief.designGoal}`,
    });

    await report("theme-director");
    const theme = await runThemeDirector(agents, profile, brief, direction);
    log.push({
      agent: "theme-director",
      role: "Art director",
      summary: `${direction.name} · ${direction.hero} hero`,
    });

    await report("layout-architect");
    const layout = await runLayoutArchitect(agents, profile, brief, theme, direction);
    log.push({
      agent: "layout-architect",
      role: "Information architect",
      summary: layout.rationale,
    });

    // Parallel track: copy + media checklist are independent of each other.
    // Reported as the copywriter because that is the slower of the two and the
    // step the user is really waiting on.
    await report("copywriter");
    const [copy, media] = await Promise.all([
      runCopywriter(agents, profile, brief, theme, layout, direction),
      runMediaDirector(agents, profile, layout, direction),
    ]);

    log.push({
      agent: "copywriter",
      role: "Church copywriter",
      summary: copy.seoTitle,
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
      layout,
      copy,
      JSON.stringify(input.features),
      direction
    );
    log.push({
      agent: "responsive-qa",
      role: "Design & mobile QA",
      summary: qa.approved
        ? `Approved · ${qa.mobileFeedback.length} mobile notes`
        : qa.issues.slice(0, 2).join(" ") || "Applied copy patches.",
    });

    const assembled = assembleGeneratedSite({
      input,
      direction,
      layout,
      copy,
      qa,
    });

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
