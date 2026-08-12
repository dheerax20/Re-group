import { prisma } from "@/lib/db";
import type { Site } from "@prisma/client";

/**
 * The renderer never resolves a tenant itself — it just receives a `site`
 * and renders it. Swapping slug.regroup.app resolution for custom-domain
 * resolution later is a one-file change here.
 */
export interface TenantResolver {
  resolve(hostname: string): Promise<Site | null>;
}

const PLATFORM_ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

export function extractSlugFromHostname(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  if (host.endsWith(`.${PLATFORM_ROOT_DOMAIN}`)) {
    const subdomain = host.slice(0, -1 * (PLATFORM_ROOT_DOMAIN.length + 1));
    if (subdomain && subdomain !== "www") {
      return subdomain;
    }
    return null;
  }

  // Future: custom domains would be looked up directly against a
  // `customDomain` column rather than derived from the hostname shape.
  return null;
}

export class SlugTenantResolver implements TenantResolver {
  async resolve(hostname: string): Promise<Site | null> {
    const slug = extractSlugFromHostname(hostname);
    if (!slug) return null;

    return prisma.site.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
  }
}

export function getTenantResolver(): TenantResolver {
  return new SlugTenantResolver();
}
