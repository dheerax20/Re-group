import { describe, expect, it } from "vitest";
import {
  dnsRecordsFor,
  isApex,
  normalizeHostname,
  validateHostname,
  wwwVariant,
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

describe("wwwVariant", () => {
  it("offers www only for an apex", () => {
    expect(wwwVariant("grace.org")).toBe("www.grace.org");
    expect(wwwVariant("www.grace.org")).toBeNull();
  });
});
