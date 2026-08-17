"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwnedPaidSite, requireOwnedSite } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { invalidateSiteHostnames } from "./resolve";
import {
  canonicalHostForSite,
  groupDomains,
  refreshDomainStatus,
  syncPrimaryDomain,
  type DomainGroup,
} from "./actions-support";
import {
  hostnameProblemMessage,
  isApex,
  pairedHostnames,
  registrableDomain,
  validateHostname,
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
  /** One entry per domain the church owns, each covering its www. partner. */
  groups: DomainGroup[];
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
    groups: groupDomains(domains),
    canonicalHost: await canonicalHostForSite(siteId, site.slug),
    platformHost: `${site.slug}.${root}`,
    published: site.status === "PUBLISHED",
  };
}

export type AddDomainResult =
  | { success: true; root: string; connected: string[] }
  | { success: false; error: string };

/**
 * Attaches a domain to this site and to the Vercel project.
 *
 * A church that types `gracechurch.org` gets `www.gracechurch.org` too, always.
 * This used to be a checkbox, which asked them to decide something they have no
 * basis to decide and no reason to decline — and a church that unticked it would
 * have visitors who type `www.` land on an error.
 *
 * Vercel is called before any row is written, so the database never claims a
 * hostname the platform cannot actually serve. The primary hostname must
 * succeed; its partner is best-effort, because a failure there is not a reason
 * to reject the domain the church actually asked for.
 */
export async function addDomain(
  siteId: string,
  input: string
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

  // The apex and its www. are one thing to a church, so they are checked and
  // attached together. The first entry is the one they asked for.
  const wanted = pairedHostnames(hostname);

  const taken = await prisma.siteDomain.findMany({
    where: { hostname: { in: wanted } },
  });
  const conflict = taken.find(
    (row) => row.siteId !== siteId || row.hostname === hostname
  );
  if (conflict) {
    return {
      success: false,
      error:
        conflict.siteId === siteId
          ? `${conflict.hostname} is already connected to your site.`
          : `${conflict.hostname} is already connected to another church's site.`,
    };
  }

  const alreadyMine = new Set(taken.map((row) => row.hostname));
  const connected: string[] = [];

  for (const candidate of wanted) {
    if (alreadyMine.has(candidate)) {
      connected.push(candidate);
      continue;
    }
    if ((await prisma.siteDomain.count({ where: { siteId } })) >= MAX_DOMAINS_PER_SITE) {
      break;
    }

    const added = await addDomainToProject(candidate);
    if (!added.ok) {
      // The hostname the church typed has to work; its partner is a courtesy.
      if (candidate === hostname) {
        return { success: false, error: explainVercelError(added.code, candidate) };
      }
      console.warn(
        `[domains] could not attach the companion ${candidate}: ${added.code}`
      );
      continue;
    }

    const created = await prisma.siteDomain.create({
      data: {
        siteId,
        hostname: candidate,
        status: added.data.verified ? "PENDING_DNS" : "PENDING_VERIFICATION",
        verification: (added.data.verification ?? []) as never,
        misconfigured: true,
      },
    });

    // Read the real state straight away so the UI opens on facts, not on the
    // optimistic row we just wrote.
    await refreshDomainStatus(created);
    connected.push(candidate);
  }

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  return { success: true, root: registrableDomain(hostname), connected };
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
  | { success: true }
  | { success: false; error: string };

/**
 * Re-checks a whole domain — the apex and its www. together.
 *
 * Keyed by the registrable domain rather than a row id, because that is the
 * unit the church is looking at. Verifying "gracechurch.org" has to cover
 * "www.gracechurch.org", or they would fix one and be told the other is still
 * broken with no way to act on it.
 */
export async function verifyDomain(
  siteId: string,
  root: string
): Promise<VerifyDomainResult> {
  const user = await requireOwnedPaidSite(siteId);
  await enforceRateLimit(`domain:verify:${user.id}`, 20, 300, "verification attempts");

  const rows = await hostnamesInGroup(siteId, root);
  if (rows.length === 0) {
    return { success: false, error: "That domain is not connected to your site." };
  }

  const problems: string[] = [];

  for (const row of rows) {
    const verified = await verifyProjectDomain(row.hostname);
    const refreshed = await refreshDomainStatus(row);

    if (!verified.ok && refreshed.status !== "ACTIVE") {
      problems.push(explainVercelError(verified.code, row.hostname));
    } else if (refreshed.status === "PENDING_VERIFICATION") {
      problems.push(
        `Still waiting on the TXT record for ${row.hostname}. DNS changes can take up to an hour to spread.`
      );
    } else if (refreshed.status === "PENDING_DNS") {
      problems.push(
        `${row.hostname} is not pointing here yet. Check the record above at your registrar.`
      );
    }
  }

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  // One message, not a list: several hostnames failing for the same reason is
  // one problem to fix, not three.
  if (problems.length > 0) {
    return { success: false, error: problems[0] };
  }
  return { success: true };
}

export async function setPrimaryDomain(siteId: string, root: string) {
  await requireOwnedPaidSite(siteId);

  const rows = await hostnamesInGroup(siteId, root);
  const live = rows.filter((row) => row.status === "ACTIVE");
  if (live.length === 0) {
    return {
      success: false as const,
      error: "This domain has to be working before it can be your main address.",
    };
  }

  // Prefer the apex: it is the address a church prints on a sign.
  const next = live.find((row) => isApex(row.hostname)) ?? live[0];

  await prisma.$transaction([
    prisma.siteDomain.updateMany({
      where: { siteId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.siteDomain.update({ where: { id: next.id }, data: { isPrimary: true } }),
  ]);

  revalidatePath("/dashboard/domains");
  return { success: true as const };
}

/**
 * Disconnects a whole domain, including its www. partner.
 *
 * Removing them together is the only sensible reading of "remove
 * gracechurch.org" — leaving the www. behind would keep a hostname claimed that
 * the church believes they have removed, and our uniqueness constraint would
 * then block them re-adding it.
 *
 * Local rows are deleted even when Vercel's delete fails, deliberately: an
 * orphan on the Vercel project is visible and harmless, whereas a stranded row
 * here is the one thing that would stop a church reconnecting their domain.
 */
export async function removeDomain(siteId: string, root: string) {
  await requireOwnedPaidSite(siteId);

  const rows = await hostnamesInGroup(siteId, root);
  if (rows.length === 0) {
    return { success: false as const, error: "That domain is not connected to your site." };
  }

  for (const row of rows) {
    if (isCustomDomainsEnabled()) {
      const removed = await removeDomainFromProject(row.hostname);
      if (!removed.ok && removed.code !== "domain_not_found") {
        console.error(
          `[domains] Vercel delete failed for ${row.hostname} (${removed.code}); removing local record anyway.`
        );
      }
    }
  }

  await prisma.siteDomain.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });

  await syncPrimaryDomain(siteId);
  await invalidateSiteHostnames(siteId);
  revalidatePath("/dashboard/domains");

  return { success: true as const };
}

/** Every row belonging to one registrable domain on this site. */
async function hostnamesInGroup(siteId: string, root: string) {
  const rows = await prisma.siteDomain.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((row) => registrableDomain(row.hostname) === root);
}
