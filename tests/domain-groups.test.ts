import { describe, expect, it } from "vitest";
import type { SiteDomain } from "@prisma/client";
import { groupDomains } from "@/lib/domains/actions-support";

function domain(overrides: Partial<SiteDomain>): SiteDomain {
  return {
    id: overrides.hostname ?? "id",
    siteId: "site_1",
    hostname: "grace.org",
    status: "PENDING_DNS",
    isPrimary: false,
    misconfigured: true,
    verification: [],
    lastCheckedAt: null,
    verifiedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as SiteDomain;
}

/**
 * The database keeps the apex and its www. as separate rows because Vercel and
 * the hostname resolver both work per-hostname. The UI must not show that split
 * — a church reading two half-configured cards cannot tell what they still owe.
 */
describe("groupDomains", () => {
  it("collapses an apex and its www into one group", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org" }),
      domain({ hostname: "www.grace.org" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].root).toBe("grace.org");
    expect(groups[0].hostnames.map((h) => h.hostname)).toEqual([
      "grace.org",
      "www.grace.org",
    ]);
  });

  it("puts the apex first regardless of insert order", () => {
    const groups = groupDomains([
      domain({ hostname: "www.grace.org" }),
      domain({ hostname: "grace.org" }),
    ]);
    expect(groups[0].hostnames[0].hostname).toBe("grace.org");
  });

  it("keeps separate domains in separate groups", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org" }),
      domain({ hostname: "gracechapel.com" }),
    ]);
    expect(groups.map((group) => group.root).sort()).toEqual([
      "grace.org",
      "gracechapel.com",
    ]);
  });

  it("is only live when every hostname in it is live", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org", status: "ACTIVE" }),
      domain({ hostname: "www.grace.org", status: "PENDING_DNS" }),
    ]);
    expect(groups[0].status).toBe("PENDING_DNS");
  });

  it("reports the worst status, so verification outranks missing DNS", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org", status: "PENDING_DNS" }),
      domain({ hostname: "www.grace.org", status: "PENDING_VERIFICATION" }),
    ]);
    expect(groups[0].status).toBe("PENDING_VERIFICATION");
  });

  it("is live when both halves are", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org", status: "ACTIVE" }),
      domain({ hostname: "www.grace.org", status: "ACTIVE" }),
    ]);
    expect(groups[0].status).toBe("ACTIVE");
  });

  it("combines both DNS records, apex A before www CNAME", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org" }),
      domain({ hostname: "www.grace.org" }),
    ]);
    expect(groups[0].records.map((record) => record.type)).toEqual(["A", "CNAME"]);
  });

  it("deduplicates identical verification records across the pair", () => {
    const challenge = [
      { type: "TXT", domain: "_vercel.grace.org", value: "abc123", reason: "pending" },
    ];
    const groups = groupDomains([
      domain({ hostname: "grace.org", verification: challenge as never }),
      domain({ hostname: "www.grace.org", verification: challenge as never }),
    ]);
    expect(groups[0].verification).toHaveLength(1);
  });

  it("marks the group primary when either hostname is", () => {
    const groups = groupDomains([
      domain({ hostname: "grace.org", isPrimary: true }),
      domain({ hostname: "www.grace.org" }),
    ]);
    expect(groups[0].isPrimary).toBe(true);
  });

  it("reports the most recent check across the group", () => {
    const groups = groupDomains([
      domain({
        hostname: "grace.org",
        lastCheckedAt: new Date("2026-01-01T10:00:00Z"),
      }),
      domain({
        hostname: "www.grace.org",
        lastCheckedAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ]);
    expect(groups[0].lastCheckedAt).toBe("2026-01-01T12:00:00.000Z");
  });
});
