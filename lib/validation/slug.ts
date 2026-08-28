import { z } from "zod";

export const reservedSlugs = new Set([
  "app",
  "api",
  "admin",
  "onboarding",
  "builder",
  "dashboard",
  "login",
  "settings",
  "sites",
  // Billing + auth routes. A church claiming one of these slugs would
  // shadow the route on its own subdomain.
  "auth",
  "post-auth",
  "upgrade",
  "welcome",
]);

export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(63, "Slug must be at most 63 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens"
  )
  .refine((slug) => !reservedSlugs.has(slug), {
    message: "This slug is reserved and cannot be used",
  });

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
}
