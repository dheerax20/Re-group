"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwnedPaidSite, requireOwnedSite } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { invalidateSiteHostnames } from "./resolve";
import {
  canonicalHostForSite,
  refreshDomainStatus,
  syncPrimaryDomain,
  toDomainView,
  type DomainView,
} from "./actions-support";
import {
  hostnameProblemMessage,
  validateHostname,
  wwwVariant,
} from "./hostname";
import {
  addDomainToProject,
  explainVercelError,
  isCustomDomainsEnabled,
  removeDomainFromProject,
  verifyProjectDomain,
} from "./vercel";

/**
 * Custom domain management.
 *
 * The invariant these actions protect: a hostname routes to at most one site,
 * and only ever to a site whose owner proved control of it. `SiteDomain.hostname`
 * is globally unique, so the claim is enforced by the database rather than by
 * remembering to check — and because the resolver caches hostnames, every write
 * here also drops that cache.
 */

/** How many domains one site may attach. Generous, but not unbounded. */
const MAX_DOMAINS_PER_SITE = 5;

export type DomainsState = {
  enabled: boolean;
  domains: DomainView[];
  /** Where the site is currently reachable, for the "live at" line. */
  canonicalHost: string;
  platformHost: string;
  published: boolean;
};

export async function getDomains(siteId: string): Promise<DomainsState> {
  await requireOwnedSite(siteId);

  const [site, domains] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      select: { slug: true, status: true },
    }),
    prisma.siteDomain.findMany({ where: { siteId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!site) throw new Error("Site not found");

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

  return {
    enabled: isCustomDomainsEnabled(),
    domains: domains.map(toDomainView),
    canonicalHost: await canonicalHostForSite(siteId, site.slug),
    platformHost: `${site.slug}.${root}`,
    published: site.status === "PUBLISHED",
  };
}

export type AddDomainResult =
  | { success: true; domain: DomainView; alsoAdded?: DomainView }
  | { success: false; error: string };

/**
 * Attaches a hostname to this site and to the Vercel project.
 *
 * Vercel is called first. If it refuses — most often because the hostname is
 * attached to another Vercel account — no row is written, so the database never
 * claims a hostname the platform cannot actually serve.
 */
export async function addDomain(
  siteId: string,
  input: string,
  options: { includeWww?: boolean } = {}
): Promise<AddDomainResult> {
  const user = await requireOwnedPaidSite(siteId);

  if (!isCustomDomainsEnabled()) {
    return {
      success: false,
      error: "Custom domains are not available on this deployment yet.",
    };
  }

  await enforceRateLimit(`domain:add:${user.id}`, 10, 3600, "domain attempts");

  const validated = validateHostname(input);
  if (!validated.ok) {
    return { success: false, error: hostnameProblemMessage(validated.problem) };
  }
  const hostname = validated.hostname;

  const count = await prisma.siteDomain.count({ where: { siteId } });
  if (count >= MAX_DOMAINS_PER_SITE) {
    return {
      success: false,
      error: `You can connect up to ${MAX_DOMAINS_PER_SITE} domains. Remove one first.`,
    };
  }

  const existing = await prisma.siteDomain.findUnique({ where: { hostname } });
  if (existing) {
    return {
      success: false,
      error:
        existing.siteId === siteId
          ? `${hostname} is already connected to your site.`
          : `${hostname} is already connected to another church's site.`,
    };
  }

  const added = await addDomainToProject(hostname);
  if (!added.ok) {
    return { success: false, error: explainVercelError(added.code, hostname) };
  }

  const created = await prisma.siteDomain.create({
    data: {
      siteId,
      hostname,
      status: added.data.verified ? "PENDING_DNS" : "PENDING_VERIFICATION",
      verification: (added.data.verification ?? []) as never,
      misconfigured: true,
    },
  });

  // Read the real state straight away so the UI opens on facts, not on the
  // optimistic row we just wrote.
  const refreshed = await refreshDomainStatus(created);

  // Churches type "gracechurch.org" and expect www to work too. Offered rather
  // than forced, and a failure here is not a failure of the apex domain.
  let alsoAdded: DomainView | undefined;
  const www = wwwVariant(hostname);
  if (options.includeWww && www && count + 1 < MAX_DOMAINS_PER_SITE) {
    const wwwTaken = await prisma.siteDomain.findUnique({ where: { hostname: www } });
    if (!wwwTaken) {
      const addedWww = await addDomainToProject(www);
      if (addedWww.ok) {
        const createdWww = await prisma.siteDomain.create({
          data: {
            siteId,
            hostname: www,
            status: addedWww.data.verified ? "PENDING_DNS" : "PENDING_VERIFICATION",
            verification: (addedWww.data.verification ?? []) as never,
            misconfigured: true,
          },
        });
        alsoAdded = toDomainView(await refreshDomainStatus(createdWww));
      }
    }
  }

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  return { success: true, domain: toDomainView(refreshed), alsoAdded };
}

/** Re-checks every domain on the site against Vercel. */
export async function refreshDomains(siteId: string): Promise<DomainsState> {
  const user = await requireOwnedPaidSite(siteId);
  await enforceRateLimit(`domain:refresh:${user.id}`, 20, 300, "domain checks");

  const domains = await prisma.siteDomain.findMany({ where: { siteId } });
  for (const domain of domains) {
    await refreshDomainStatus(domain);
  }

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  return getDomains(siteId);
}

export type VerifyDomainResult =
  | { success: true; domain: DomainView }
  | { success: false; error: string; domain?: DomainView };

/** Asks Vercel to re-run the TXT ownership challenge, then re-reads state. */
export async function verifyDomain(
  siteId: string,
  domainId: string
): Promise<VerifyDomainResult> {
  const user = await requireOwnedPaidSite(siteId);
  await enforceRateLimit(`domain:verify:${user.id}`, 20, 300, "verification attempts");

  const domain = await prisma.siteDomain.findFirst({
    where: { id: domainId, siteId },
  });
  if (!domain) return { success: false, error: "That domain is not connected to your site." };

  const verified = await verifyProjectDomain(domain.hostname);
  const refreshed = await refreshDomainStatus(domain);
  const view = toDomainView(refreshed);

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  if (!verified.ok) {
    return {
      success: false,
      error: explainVercelError(verified.code, domain.hostname),
      domain: view,
    };
  }

  if (refreshed.status !== "ACTIVE") {
    return {
      success: false,
      error:
        refreshed.status === "PENDING_VERIFICATION"
          ? "Still waiting on the TXT record. DNS changes can take up to an hour to spread."
          : "Ownership is confirmed, but the DNS records above are not pointing here yet.",
      domain: view,
    };
  }

  return { success: true, domain: view };
}

export async function setPrimaryDomain(siteId: string, domainId: string) {
  await requireOwnedPaidSite(siteId);

  const domain = await prisma.siteDomain.findFirst({ where: { id: domainId, siteId } });
  if (!domain) return { success: false as const, error: "That domain is not connected to your site." };
  if (domain.status !== "ACTIVE") {
    return {
      success: false as const,
      error: "A domain has to be live before it can be your main address.",
    };
  }

  await prisma.$transaction([
    prisma.siteDomain.updateMany({
      where: { siteId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.siteDomain.update({ where: { id: domainId }, data: { isPrimary: true } }),
  ]);

  revalidatePath("/dashboard/domains");
  return { success: true as const };
}

/**
 * Detaches a hostname from the site and the Vercel project.
 *
 * The local row is deleted even when Vercel's delete fails, and deliberately:
 * leaving it behind would keep a hostname the church has disowned claimed in
 * our uniqueness constraint, which is the one thing that would stop them
 * re-adding it. An orphan on the Vercel project is visible and harmless.
 */
export async function removeDomain(siteId: string, domainId: string) {
  await requireOwnedPaidSite(siteId);

  const domain = await prisma.siteDomain.findFirst({ where: { id: domainId, siteId } });
  if (!domain) return { success: false as const, error: "That domain is not connected to your site." };

  if (isCustomDomainsEnabled()) {
    const removed = await removeDomainFromProject(domain.hostname);
    if (!removed.ok && removed.code !== "domain_not_found") {
      console.error(
        `[domains] Vercel delete failed for ${domain.hostname} (${removed.code}); removing local record anyway.`
      );
    }
  }

  await prisma.siteDomain.delete({ where: { id: domain.id } });
  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  return { success: true as const };
}
