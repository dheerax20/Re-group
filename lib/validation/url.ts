import { z } from "zod";
import { SITE_PAGE_LINKS } from "@/lib/site/pages";

/**
 * URL rules for anything that reaches an `href` or `src` on a published site.
 *
 * Section config is authored in the visual editor and by the AI crew, then
 * rendered into `<Link href>` and `<img src>` on a public church website. An
 * unchecked string there is a script-execution vector (`javascript:`), a
 * data-exfiltration vector (`data:`), and an open-redirect. Churches are hosted
 * on subdomains of one root domain, so one tenant's bad URL is every tenant's
 * domain reputation.
 *
 * Two shapes are allowed and nothing else:
 *   - an internal path, which must be one of the site's own pages or an anchor
 *   - an absolute `https:` URL (plus `mailto:` and `tel:` for contact details)
 */

const INTERNAL_PATHS = new Set(SITE_PAGE_LINKS.map((page) => page.href));

/** Protocols that can execute or smuggle content. Never allowed anywhere. */
const DANGEROUS_PROTOCOLS = /^\s*(javascript|data|vbscript|file|blob):/i;

export function isSafeInternalPath(value: string): boolean {
  if (DANGEROUS_PROTOCOLS.test(value)) return false;
  // Protocol-relative URLs (`//evil.com`) are absolute despite starting with a
  // slash, so they must not pass the internal-path branch.
  if (value.startsWith("//")) return false;
  if (value.startsWith("#")) return /^#[\w-]{1,64}$/.test(value);
  if (!value.startsWith("/")) return false;

  const [pathname] = value.split(/[?#]/);
  if (INTERNAL_PATHS.has(pathname)) return true;

  // Detail pages under a known collection: /sermons/<slug>, /events/<slug>.
  return /^\/(sermons|events)\/[a-z0-9]+(-[a-z0-9]+)*$/.test(pathname);
}

export function isSafeExternalUrl(value: string): boolean {
  if (DANGEROUS_PROTOCOLS.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "mailto:" || url.protocol === "tel:";
  } catch {
    return false;
  }
}

export function isSafeLinkTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isSafeInternalPath(trimmed) || isSafeExternalUrl(trimmed);
}

/**
 * Normalizes a link for rendering. Returns `fallback` for anything unsafe, so a
 * bad value already in the database degrades to a working link instead of
 * shipping to visitors. Render paths must use this; write paths use the schemas.
 */
export function safeLinkTarget(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return isSafeLinkTarget(trimmed) ? trimmed : fallback;
}

/** Same idea for image and video sources: https or nothing. */
export function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    // A root-relative path into our own public assets is fine.
    return trimmed.startsWith("/") && !trimmed.startsWith("//") ? trimmed : undefined;
  }
}

export const linkTargetSchema = z
  .string()
  .trim()
  .refine(isSafeLinkTarget, "Use one of your own pages or an https:// link");

export const mediaUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || safeMediaUrl(value) !== undefined, {
    message: "Use an https:// image URL",
  });

/** For fields stored on the site record itself (giving, podcast, YouTube). */
export const httpsUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isSafeExternalUrl(value), {
    message: "Use a full https:// URL",
  });
