import type { SectionInstance } from "@/lib/site/types";
import type { SiteGenerationInput } from "./types";

function joinLocation(city?: string) {
  return city?.trim() || "our city";
}

export function composeSectionCopy(
  input: SiteGenerationInput,
  sections: SectionInstance[]
): SectionInstance[] {
  const name = input.churchName;
  const tagline = input.tagline || "A place to belong.";
  const city = input.story?.city;
  const times = input.story?.serviceTimes || "Sundays at 10:00 AM";
  const mission =
    input.story?.mission ||
    `${name} exists to help people know God, find family, and live with purpose in ${joinLocation(city)}.`;
  const worship = input.story?.worshipStyle || "gathered worship";
  const pastor = input.story?.pastorName;
  const values = (input.story?.values || "Faith, belonging, and generous service")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const size =
    input.congregationSize && input.congregationSize > 0
      ? `${input.congregationSize}+`
      : "Growing";

  const ministries = values.slice(0, 3).map((value, index) => {
    const catalog = [
      { name: "Kids & Families", description: `Safe, joyful spaces where children grow in faith at ${name}.` },
      { name: "Students", description: "A home for students to ask honest questions and build real friendship." },
      { name: "Groups", description: "Midweek circles for prayer, Scripture, and life together." },
    ];
    return catalog[index] ?? { name: value, description: `A ministry shaped around ${value.toLowerCase()}.` };
  });

  return sections.map((section) => {
    const extra: Record<string, unknown> = { ...section.config };

    if (section.type === "hero") {
      extra.eyebrow = city ? `${name} · ${city}` : name;
      extra.title = tagline.length < 48 ? tagline : `Welcome to ${name}`;
      extra.description = `${mission} Join us ${times}.`;
      extra.primaryCta = { label: "Plan your visit", href: "/contact" };
      extra.stats = [
        { label: "Gather", value: times },
        { label: "Community", value: size },
        { label: "Worship", value: worship },
      ];
    }

    if (section.type === "welcome") {
      extra.eyebrow = "Welcome home";
      extra.title = pastor ? `A word from ${pastor}` : `You belong at ${name}`;
      extra.description = mission;
    }

    if (section.type === "about") {
      extra.eyebrow = input.denomination || "Our story";
      extra.title = "Who we are";
      extra.description = `${mission}${pastor ? ` ${pastor} and our team would love to meet you.` : ""}`;
    }

    if (section.type === "ministries") {
      extra.eyebrow = "Get involved";
      extra.title = "Ways to belong";
      extra.items = ministries;
    }

    if (section.type === "cta") {
      extra.title = `Join us this Sunday`;
      extra.description = `${times}${city ? ` in ${city}` : ""}. Come as you are.`;
      extra.cta = { label: "Plan your visit", href: "/contact" };
    }

    if (section.type === "sermons") {
      extra.eyebrow = "Teachings";
      extra.title = "Recent messages";
      extra.description = `Listen to the latest from ${name}.`;
    }

    if (section.type === "events") {
      extra.eyebrow = "Calendar";
      extra.title = "What's happening";
      extra.description = `Gatherings, meals, and moments that make ${name} feel like family.`;
    }

    if (section.type === "contact") {
      extra.eyebrow = "Visit";
      extra.title = "We'd love to meet you";
      extra.description = city
        ? `Find us in ${city}. ${times}.`
        : `Come see us this week. ${times}.`;
    }

    return { ...section, config: extra };
  });
}
