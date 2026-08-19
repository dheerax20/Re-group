/**
 * End-to-end check of the AI build pipeline, without the browser.
 *
 * Creates (or reuses) a site for the first user, queues a job the same way
 * `ai.startBuild` does, triggers the task, then watches the job row — which is
 * the same row the studio's progress reads.
 */
import { PrismaClient } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";

const p = new PrismaClient();
const user = await p.user.findFirst({ include: { site: true } });
if (!user) throw new Error("no user in the database");

let site = user.site;
if (!site) {
  site = await p.site.create({
    data: {
      userId: user.id,
      name: "Grace Test Church",
      slug: `test-${Math.random().toString(36).slice(2, 8)}`,
      tagline: "A place to belong",
      denomination: "Baptist",
      congregationSize: 150,
      brandConfig: { colors: { primary: "#1E3A5F", secondary: "#D4AF37", background: "#FFFFFF", foreground: "#111827", accent: "#D4AF37" }, typography: { primaryFont: "inter", secondaryFont: "playfair-display" }, logo: { url: "", alt: "" }, favicon: { url: "" }, tagline: "A place to belong" },
      featureConfig: { sermons: true, sermonSearch: false, events: true, youtube: false, podcast: false, giving: false, ministries: false, contact: true },
      navigationConfig: [],
      sectionConfig: [],
      seoConfig: { title: "", description: "" },
      storyConfig: { city: "Atlanta", worshipStyle: "Contemporary", serviceTimes: "Sundays 9am & 11am", pastorName: "Pastor Lee", mission: "Know God, find family", values: "Faith, hospitality, justice" },
      templateId: "modern-church",
      templateVersion: 1,
    },
  });
  console.log("created site", site.slug);
}

const job = await p.siteGenerationJob.create({
  data: { siteId: site.id, kind: "full_build", status: "QUEUED", totalSteps: 6 },
});
const handle = await tasks.trigger("full-build", { siteId: site.id, jobId: job.id }, { idempotencyKey: `build-${job.id}` });
await p.siteGenerationJob.update({ where: { id: job.id }, data: { triggerRunId: handle.id } });
console.log("triggered run", handle.id);

const deadline = Date.now() + 240_000;
let last = "";
while (Date.now() < deadline) {
  const j = await p.siteGenerationJob.findUnique({ where: { id: job.id } });
  const line = `${j.status} step=${j.step ?? "-"} idx=${j.stepIndex}`;
  if (line !== last) { console.log(new Date().toISOString().slice(11, 19), line); last = line; }
  if (j.status === "SUCCEEDED" || j.status === "FAILED") {
    console.log("FINAL:", j.status, j.error ?? j.summary ?? "");
    const s = await p.site.findUnique({ where: { id: site.id }, select: { blockConfig: true, templateId: true } });
    console.log("blocks written:", Array.isArray(s.blockConfig) ? s.blockConfig.length : 0, "| template:", s.templateId);
    break;
  }
  await new Promise(r => setTimeout(r, 2000));
}
await p.$disconnect();
