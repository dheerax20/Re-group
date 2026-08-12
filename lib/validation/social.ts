import { z } from "zod";

export const socialPlatforms = [
  "facebook",
  "instagram",
  "youtube",
  "x",
  "tiktok",
] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), {
    message: "Must be a valid URL starting with http:// or https://",
  });

export const socialLinksSchema = z.object({
  facebook: optionalUrl.optional().default(""),
  instagram: optionalUrl.optional().default(""),
  youtube: optionalUrl.optional().default(""),
  x: optionalUrl.optional().default(""),
  tiktok: optionalUrl.optional().default(""),
});

export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

/** Only non-empty URLs get persisted as SocialLink rows. */
export function toSocialLinkRecords(
  input: SocialLinksInput
): Array<{ platform: SocialPlatform; url: string }> {
  return socialPlatforms
    .filter((platform) => input[platform] && input[platform] !== "")
    .map((platform) => ({ platform, url: input[platform] as string }));
}

export const podcastRssSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/.+\.(xml|rss)?.*$/i.test(v), {
    message: "Must look like a valid RSS feed URL",
  })
  .optional()
  .default("");
