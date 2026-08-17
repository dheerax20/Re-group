import type { GeneratedSiteConfig, SiteGenerationInput, SiteGenerationProvider } from "@/lib/ai/types";
import { assembleGeneratedSite } from "./assemble";
import { profileForAgents } from "./catalog";
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
  { id: "theme-director", label: "Art director", detail: "Cinematic look & mobile grid" },
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
  constructor(
    private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY
  ) {}

  async generateSiteConfig(input: SiteGenerationInput): Promise<GeneratedSiteConfig> {
    const built = await this.build(input);
    return {
      sections: built.sections,
      navigation: built.navigation,
      seo: built.seo,
    };
  }

  async build(
    input: SiteGenerationInput,
    onProgress?: CrewProgress
  ): Promise<ChurchWebsiteBuild> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is missing, so the AI crew cannot build a website.");
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

    const log: AgentLogEntry[] = [];
    const agents = createChurchAgents(this.apiKey);
    const profile = profileForAgents(input);

    await report("producer");
    const brief = await runProducer(agents, profile);
    log.push({
      agent: "producer",
      role: "Executive producer",
      summary: `${brief.churchArchetype}. ${brief.designGoal}`,
    });

    await report("theme-director");
    const theme = await runThemeDirector(agents, profile, brief);
    log.push({
      agent: "theme-director",
      role: "Art director",
      summary: `${theme.styleName} · ${theme.heroTreatment} hero`,
    });

    await report("layout-architect");
    const layout = await runLayoutArchitect(agents, profile, brief, theme);
    log.push({
      agent: "layout-architect",
      role: "Information architect",
      summary: layout.rationale,
    });

    // Parallel track: copy + media checklist (user-provided photos — no AI image gen).
    // Reported as the copywriter because that is the slower of the two and the
    // step the user is really waiting on.
    await report("copywriter");
    const [copy, media] = await Promise.all([
      runCopywriter(agents, profile, brief, theme, layout),
      runMediaDirector(agents, profile, layout),
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
      JSON.stringify(input.features)
    );
    log.push({
      agent: "responsive-qa",
      role: "Design & mobile QA",
      summary: qa.approved
        ? `Approved · ${qa.mobileFeedback.length} mobile notes`
        : qa.issues.slice(0, 2).join(" ") || "Applied layout patches.",
    });

    const assembled = assembleGeneratedSite({
      input,
      theme,
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
      styleName: theme.styleName,
      improvements,
      designFeedback: qa.designFeedback,
      mobileFeedback: qa.mobileFeedback,
    };
  }
}
