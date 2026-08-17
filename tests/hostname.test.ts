import { describe, expect, it } from "vitest";
import {
  dnsRecordsFor,
  isApex,
  normalizeHostname,
  pairedHostnames,
  registrableDomain,
  validateHostname,
} from "@/lib/domains/hostname";

describe("normalizeHostname", () => {
  it("strips what churches actually paste", () => {
    expect(normalizeHostname("https://GraceChurch.org/welcome")).toBe("gracechurch.org");
    expect(normalizeHostname("  http://www.grace.org:8080  ")).toBe("www.grace.org");
    expect(normalizeHostname("grace.org.")).toBe("grace.org");
    expect(normalizeHostname("pastor@grace.org")).toBe("grace.org");
  });
});

describe("validateHostname", () => {
  it("accepts real domains", () => {
    expect(validateHostname("gracechurch.org")).toEqual({
      ok: true,
      hostname: "gracechurch.org",
    });
    expect(validateHostname("www.grace-church.co.uk")).toEqual({
      ok: true,
      hostname: "www.grace-church.co.uk",
    });
  });

  it("rejects a bare word with no dot", () => {
    expect(validateHostname("gracechurch")).toEqual({ ok: false, problem: "needs_dot" });
  });

  it("rejects wildcards", () => {
    expect(validateHostname("*.grace.org")).toEqual({ ok: false, problem: "wildcard" });
  });

  it("rejects the platform's own domain, which is already handled", () => {
    expect(validateHostname("regroup.app")).toEqual({
      ok: false,
      problem: "platform_domain",
    });
    expect(validateHostname("grace.regroup.app")).toEqual({
      ok: false,
      problem: "platform_domain",
    });
  });

  it("rejects local and IP addresses", () => {
    expect(validateHostname("grace.localhost")).toEqual({ ok: false, problem: "local" });
    expect(validateHostname("127.0.0.1")).toEqual({ ok: false, problem: "local" });
  });

  it("rejects illegal characters", () => {
    expect(validateHostname("grace church.org")).toEqual({
      ok: false,
      problem: "invalid_characters",
    });
    expect(validateHostname("-grace.org")).toEqual({
      ok: false,
      problem: "invalid_characters",
    });
  });
});

describe("isApex", () => {
  it("recognises two-label domains", () => {
    expect(isApex("grace.org")).toBe(true);
    expect(isApex("www.grace.org")).toBe(false);
  });

  it("handles multi-part suffixes", () => {
    expect(isApex("grace.co.uk")).toBe(true);
    expect(isApex("www.grace.co.uk")).toBe(false);
  });
});

describe("dnsRecordsFor", () => {
  it("gives an apex an A record, because CNAME at a zone apex is invalid", () => {
    const [record] = dnsRecordsFor("grace.org");
    expect(record.type).toBe("A");
    expect(record.name).toBe("@");
    expect(record.value).toBe("76.76.21.21");
  });

  it("gives a subdomain a CNAME named with only its own label", () => {
    const [record] = dnsRecordsFor("www.grace.org");
    expect(record.type).toBe("CNAME");
    expect(record.name).toBe("www");
    expect(record.value).toBe("cname.vercel-dns.com");
  });
});

describe("registrableDomain", () => {
  it("collapses a www host onto its apex", () => {
    expect(registrableDomain("www.grace.org")).toBe("grace.org");
    expect(registrableDomain("grace.org")).toBe("grace.org");
  });

  it("handles multi-part suffixes", () => {
    expect(registrableDomain("www.grace.co.uk")).toBe("grace.co.uk");
    expect(registrableDomain("grace.co.uk")).toBe("grace.co.uk");
  });

  it("collapses a deeper subdomain onto the registrable domain", () => {
    expect(registrableDomain("give.grace.org")).toBe("grace.org");
  });
});

describe("pairedHostnames", () => {
  it("pairs an apex with its www, apex first", () => {
    expect(pairedHostnames("grace.org")).toEqual(["grace.org", "www.grace.org"]);
  });

  it("pairs a www input with its apex, apex first", () => {
    // Whichever half a church types, both get connected and the apex leads —
    // so the DNS list always reads A record then CNAME.
    expect(pairedHostnames("www.grace.org")).toEqual(["grace.org", "www.grace.org"]);
  });

  it("pairs across a multi-part suffix", () => {
    expect(pairedHostnames("grace.co.uk")).toEqual([
      "grace.co.uk",
      "www.grace.co.uk",
    ]);
  });

  it("leaves a deeper subdomain alone, having no conventional partner", () => {
    expect(pairedHostnames("give.grace.org")).toEqual(["give.grace.org"]);
  });
});
