import { PrismaClient, Prisma } from "@prisma/client";
import { AI_GENERATED_TEMPLATE_ID, AI_GENERATED_TEMPLATE_VERSION } from "../lib/ai/agents/schemas";
import { generateNavigation } from "../lib/site/navigation";
import { defaultFeatures } from "../lib/features/types";
import { slugify } from "../lib/validation/slug";

const prisma = new PrismaClient();

async function seedDemoChurch() {
  const churchName = "Grace Community Church";
  const slug = slugify(churchName);

  const features = {
    ...defaultFeatures,
    sermonSearch: true,
    youtube: true,
    giving: true,
    ministries: true,
  };

  // No stock templates any more: a seeded church starts with an empty page
  // and gets its homepage from the AI crew, exactly like a real signup does.
  const sections: unknown[] = [];

  const navigation = generateNavigation(features);

  const brandConfig = {
    colors: {
      primary: "#1E3A5F",
      secondary: "#D4AF37",
      background: "#FFFFFF",
      foreground: "#111827",
      accent: "#D4AF37",
    },
    typography: {
      primaryFont: "dm-sans",
      secondaryFont: "playfair-display",
    },
    logo: { url: "/seed/grace-logo.svg", alt: churchName },
    favicon: { url: "/seed/grace-favicon.svg" },
    tagline: "A place to belong",
  };

  const site = await prisma.site.upsert({
    where: { slug },
    update: {},
    create: {
      name: churchName,
      slug,
      denomination: "Baptist",
      congregationSize: 800,
      primaryContactName: "Pastor John Miller",
      primaryContactEmail: "info@gracecommunity.church",
      primaryContactPhone: "(555) 123-4567",
      tagline: "A place to belong",
      status: "PUBLISHED",
      publishedAt: new Date(),
      brandConfig: brandConfig as Prisma.InputJsonValue,
      featureConfig: features as Prisma.InputJsonValue,
      navigationConfig: navigation as unknown as Prisma.InputJsonValue,
      sectionConfig: sections as unknown as Prisma.InputJsonValue,
      seoConfig: {
        title: `${churchName} — A place to belong`,
        description:
          "Join Grace Community Church for worship, sermons, events, and community.",
      } as Prisma.InputJsonValue,
      storyConfig: {
        city: "Austin",
        worshipStyle: "Contemporary",
        serviceTimes: "Sundays 9am & 11am",
        pastorName: "Pastor John Miller",
        mission: "Helping people know God, find family, and live with purpose.",
        values: "Faith, hospitality, justice",
      } as Prisma.InputJsonValue,
      templateId: AI_GENERATED_TEMPLATE_ID,
      templateVersion: AI_GENERATED_TEMPLATE_VERSION,
    },
  });

  await prisma.socialLink.deleteMany({ where: { siteId: site.id } });
  await prisma.socialLink.createMany({
    data: [
      { siteId: site.id, platform: "facebook", url: "https://facebook.com/gracecommunity" },
      { siteId: site.id, platform: "instagram", url: "https://instagram.com/gracecommunity" },
      { siteId: site.id, platform: "youtube", url: "https://youtube.com/@gracecommunity" },
    ],
  });

  await prisma.media.createMany({
    data: [
      { siteId: site.id, type: "LOGO", url: brandConfig.logo.url, altText: churchName },
      { siteId: site.id, type: "FAVICON", url: brandConfig.favicon.url },
    ],
  });

  const sermons = [
    {
      title: "Finding Peace in a Chaotic World",
      speaker: "Pastor John Miller",
      series: "Peace Beyond Understanding",
      daysAgo: 3,
      description: "How to find lasting peace when everything around us feels uncertain.",
    },
    {
      title: "The Power of Community",
      speaker: "Pastor John Miller",
      series: "Better Together",
      daysAgo: 10,
      description: "Why we were never meant to walk through life alone.",
    },
    {
      title: "Grace That Changes Everything",
      speaker: "Rev. Sarah Chen",
      series: "Grace Beyond Understanding",
      daysAgo: 17,
      description: "Exploring the transformative power of grace in daily life.",
    },
    {
      title: "Hope for the Weary",
      speaker: "Pastor John Miller",
      series: "Peace Beyond Understanding",
      daysAgo: 24,
      description: "Practical encouragement for those who are tired and worn down.",
    },
  ];

  await prisma.sermon.deleteMany({ where: { siteId: site.id } });
  for (const sermon of sermons) {
    const sermonSlug = slugify(sermon.title);
    await prisma.sermon.create({
      data: {
        siteId: site.id,
        title: sermon.title,
        slug: sermonSlug,
        description: sermon.description,
        speaker: sermon.speaker,
        series: sermon.series,
        date: new Date(Date.now() - sermon.daysAgo * 24 * 60 * 60 * 1000),
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
  }

  const events = [
    {
      title: "Sunday Worship Gathering",
      daysFromNow: 3,
      location: "Main Sanctuary",
      description: "Join us for worship, teaching, and community every Sunday at 10am.",
    },
    {
      title: "Community Outreach Day",
      daysFromNow: 12,
      location: "Downtown Community Center",
      description: "Serving our neighbors through food distribution and encouragement.",
    },
    {
      title: "Youth Group Kickoff",
      daysFromNow: 20,
      location: "Youth Building",
      description: "A new season of youth group starts here — games, worship, and community.",
    },
  ];

  await prisma.event.deleteMany({ where: { siteId: site.id } });
  for (const event of events) {
    const eventSlug = slugify(event.title);
    const startAt = new Date(Date.now() + event.daysFromNow * 24 * 60 * 60 * 1000);
    await prisma.event.create({
      data: {
        siteId: site.id,
        title: event.title,
        slug: eventSlug,
        description: event.description,
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        location: event.location,
      },
    });
  }

  console.log(`Seeded demo church "${churchName}" at /sites/${slug}`);
}

async function main() {
  // Opt-in: the demo church writes a full published site, which is useful for
  // local work on the public renderer and wrong to run against a real database.
  if (process.env.SEED_DEMO_CHURCH === "1") {
    await seedDemoChurch();
  } else {
    console.log("Skipping demo church. Set SEED_DEMO_CHURCH=1 to include it.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
