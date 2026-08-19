import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { coerceSections } from "@/lib/validation/section";
import { invalidateSite } from "@/lib/site/invalidate";
import { parseChurchStory } from "@/lib/site/story";
import type { SectionInstance } from "@/lib/site/types";
import { applyEditorAiPrompt } from "./editor-prompt";

/**
 * The one-shot editor prompt, persisted.
 *
 * `applyEditorAiPrompt` only produces a result; this is the write side, and it
 * is deliberately the same shape as the chatbot's edit node — load, call,
 * repair with `coerceSections`, persist, invalidate. Model output is never
 * written unrepaired, on either path.
 */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function runEditorPrompt(siteId: string, prompt: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const result = await applyEditorAiPrompt({
    churchName: site.name,
    prompt,
    sections: coerceSections(site.sectionConfig) as SectionInstance[],
    features: (site.featureConfig as Record<string, unknown>) ?? {},
  });

  const sections = coerceSections(result.sections) as SectionInstance[];

  await prisma.site.update({
    where: { id: siteId },
    data: {
      sectionConfig: toJson(sections),
      // Persisted rather than only returned: the editor's "Needs" checklist
      // reads these back off the site record, so they have to survive a reload.
      storyConfig: toJson({
        ...parseChurchStory(site.storyConfig),
        improvements: result.improvements,
        designFeedback: result.designFeedback,
        mobileFeedback: result.mobileFeedback,
      }),
    },
  });

  await invalidateSite(siteId, { slug: site.slug });

  return {
    summary: result.summary,
    sections,
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}
