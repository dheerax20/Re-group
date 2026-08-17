import type { DomainStatus, SiteDomain } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalidateSiteHostnames, resolveHostnameToSlug } from "./resolve";
import {
  dnsRecordsFor,
  isApex,
  registrableDomain,
  type DnsRecord,
} from "./hostname";
import {
  getDomainConfig,
  getProjectDomain,
  isCustomDomainsEnabled,
  type VercelVerification,
} from "./vercel";

/**
 * Shared domain logic that is not itself a server action.
 *
 * Split out so `lib/site/actions.ts` can call `syncPrimaryDomain` after a
 * publish without importing a `"use server"` module into another one, which
 * would export every function in this file as a callable endpoint.
 */

export type DomainView = {
  id: string;
  hostname: string;
  status: DomainStatus;
  isPrimary: boolean;
  misconfigured: boolean;
  isApex: boolean;
  records: DnsRecord[];
  verification: DnsRecord[];
  lastCheckedAt: string | null;
  createdAt: string;
};

function verificationRecords(value: unknown): DnsRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is VercelVerification => Boolean(row) && typeof row === "object")
    .map((row) => ({
      type: "TXT" as const,
      name: typeof row.domain === "string" ? row.domain : "@",
      value: typeof row.value === "string" ? row.value : "",
      note: "Vercel needs this to confirm you own the domain.",
    }))
    .filter((record) => record.value !== "");
}

/**
 * One domain as a church thinks of it: "gracechurch.org", including its `www.`
 * partner, with a single status and one combined list of DNS records.
 *
 * The database stores the apex and the `www.` as separate rows because Vercel
 * and the hostname resolver both work per-hostname. Showing that split in the UI
 * made a church read two cards, each half-configured, and guess whether they
 * were supposed to act on both.
 */
export type DomainGroup = {
  /** The registrable domain, used as the group's identity and heading. */
  root: string;
  /** Rows in this group; the apex first when it is present. */
  hostnames: DomainView[];
  /** Worst status in the group — the group is only live when everything is. */
  status: DomainStatus;
  isPrimary: boolean;
  /** Every record the church must add, across the whole group, deduplicated. */
  records: DnsRecord[];
  verification: DnsRecord[];
  lastCheckedAt: string | null;
};

const STATUS_SEVERITY: Record<DomainStatus, number> = {
  ACTIVE: 0,
  PENDING_DNS: 1,
  PENDING_VERIFICATION: 2,
};

function dedupeRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.type}|${record.name}|${record.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupDomains(domains: SiteDomain[]): DomainGroup[] {
  const groups = new Map<string, DomainView[]>();

  for (const domain of domains) {
    const root = registrableDomain(domain.hostname);
    const existing = groups.get(root) ?? [];
    existing.push(toDomainView(domain));
    groups.set(root, existing);
  }

  return [...groups.entries()].map(([root, hostnames]) => {
    // Apex first, so the DNS records read in the order a registrar form does.
    hostnames.sort((a, b) => Number(b.isApex) - Number(a.isApex));

    const status = hostnames.reduce<DomainStatus>(
      (worst, view) =>
        STATUS_SEVERITY[view.status] > STATUS_SEVERITY[worst] ? view.status : worst,
      "ACTIVE"
    );

    const checked = hostnames
      .map((view) => view.lastCheckedAt)
      .filter((value): value is string => value !== null)
      .sort();

    return {
      root,
      hostnames,
      status,
      isPrimary: hostnames.some((view) => view.isPrimary),
      records: dedupeRecords(hostnames.flatMap((view) => view.records)),
      verification: dedupeRecords(hostnames.flatMap((view) => view.verification)),
      lastCheckedAt: checked.length > 0 ? checked[checked.length - 1] : null,
    };
  });
}

export function toDomainView(domain: SiteDomain): DomainView {
  return {
    id: domain.id,
    hostname: domain.hostname,
    status: domain.status,
    isPrimary: domain.isPrimary,
    misconfigured: domain.misconfigured,
    isApex: isApex(domain.hostname),
    records: dnsRecordsFor(domain.hostname),
    verification: verificationRecords(domain.verification),
    lastCheckedAt: domain.lastCheckedAt ? domain.lastCheckedAt.toISOString() : null,
    createdAt: domain.createdAt.toISOString(),
  };
}

/**
 * Re-reads one domain's real state from Vercel and stores it.
 *
 * The status is derived from two independent facts, and both matter:
 * `verified` means Vercel accepts that we may serve this hostname, and
 * `misconfigured` means the customer's DNS does not actually point here. A
 * domain is only ACTIVE when it is verified AND configured, because serving a
 * half-ready domain shows visitors a Vercel error page under the church's name.
 */
export async function refreshDomainStatus(domain: SiteDomain): Promise<SiteDomain> {
  if (!isCustomDomainsEnabled()) return domain;

  const [project, config] = await Promise.all([
    getProjectDomain(domain.hostname),
    getDomainConfig(domain.hostname),
  ]);

  // A transient Vercel outage must not demote a working domain.
  if (!project.ok) {
    if (project.code === "domain_not_found") {
      return prisma.siteDomain.update({
        where: { id: domain.id },
        data: {
          status: "PENDING_DNS",
          misconfigured: true,
          lastCheckedAt: new Date(),
        },
      });
    }
    return prisma.siteDomain.update({
      where: { id: domain.id },
      data: { lastCheckedAt: new Date() },
    });
  }

  const verified = project.data.verified;
  const verification = project.data.verification ?? [];
  const misconfigured = config.ok ? config.data.misconfigured : domain.misconfigured;

  let status: DomainStatus;
  if (!verified) {
    status = verification.length > 0 ? "PENDING_VERIFICATION" : "PENDING_DNS";
  } else if (misconfigured) {
    status = "PENDING_DNS";
  } else {
    status = "ACTIVE";
  }

  const updated = await prisma.siteDomain.update({
    where: { id: domain.id },
    data: {
      status,
      misconfigured,
      verification: verification as never,
      lastCheckedAt: new Date(),
      verifiedAt:
        status === "ACTIVE" ? (domain.verifiedAt ?? new Date()) : null,
    },
  });

  // Whether this hostname resolves has changed, so the resolver cache must go.
  if (updated.status !== domain.status) {
    await invalidateSiteHostnames(domain.siteId);
  }

  /**
   * Warm the mapping the moment the domain is live, instead of waiting for the
   * first visitor to trigger a cache miss in the proxy. The proxy's miss path
   * depends on the internal resolver route being reachable and configured;
   * priming from here — where Prisma is available — means a correctly set up
   * domain serves the church site even if that path is briefly broken.
   */
  if (updated.status === "ACTIVE") {
    await resolveHostnameToSlug(updated.hostname).catch((error) => {
      console.error(`[domains] cache warm failed for ${updated.hostname}`, error);
    });
  }

  return updated;
}

/**
 * Keeps exactly one domain marked primary.
 *
 * Called after a publish as well as after domain edits: a site that has just
 * gone live with an active domain and no primary should get one, so canonical
 * URLs and the "your site is live at" copy have something to point at.
 */
export async function syncPrimaryDomain(siteId: string): Promise<void> {
  const domains = await prisma.siteDomain.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });
  if (domains.length === 0) return;

  const active = domains.filter((domain) => domain.status === "ACTIVE");
  const currentPrimary = domains.find((domain) => domain.isPrimary);

  // A primary that is no longer active is worse than none — it would be used to
  // build canonical URLs that do not resolve.
  const primaryIsUsable = currentPrimary?.status === "ACTIVE";
  if (primaryIsUsable) {
    const stale = domains.filter(
      (domain) => domain.isPrimary && domain.id !== currentPrimary.id
    );
    if (stale.length > 0) {
      await prisma.siteDomain.updateMany({
        where: { id: { in: stale.map((domain) => domain.id) } },
        data: { isPrimary: false },
      });
    }
    return;
  }

  // Prefer an apex domain over its www companion when both are live.
  const next = active.find((domain) => isApex(domain.hostname)) ?? active[0];

  await prisma.$transaction([
    prisma.siteDomain.updateMany({
      where: { siteId, isPrimary: true },
      data: { isPrimary: false },
    }),
    ...(next
      ? [
          prisma.siteDomain.update({
            where: { id: next.id },
            data: { isPrimary: true },
          }),
        ]
      : []),
  ]);
}

/**
 * The hostname a site should be advertised under: its primary custom domain if
 * one is live, otherwise its platform subdomain.
 */
export async function canonicalHostForSite(
  siteId: string,
  slug: string
): Promise<string> {
  const primary = await prisma.siteDomain.findFirst({
    where: { siteId, isPrimary: true, status: "ACTIVE" },
    select: { hostname: true },
  });
  if (primary) return primary.hostname;

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";
  return `${slug}.${root}`;
}
