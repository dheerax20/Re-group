import { z } from "zod";

/**
 * Rules for a customer-supplied hostname, and the DNS a customer must add.
 *
 * Kept free of Vercel and Prisma imports so both the proxy and the UI can use
 * it — the proxy runs in its own optimized environment and must not pull the
 * database client in behind a validation helper.
 */

export const PLATFORM_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

/**
 * Vercel's anycast targets. These are the values Vercel documents for
 * apex A records and subdomain CNAMEs; overridable because Enterprise projects
 * are assigned dedicated addresses.
 */
export const VERCEL_APEX_IP = process.env.VERCEL_APEX_IP ?? "76.76.21.21";
export const VERCEL_CNAME_TARGET =
  process.env.VERCEL_CNAME_TARGET ?? "cname.vercel-dns.com";

/**
 * Suffixes where the registrable domain is three labels rather than two, so
 * `church.co.uk` is recognised as an apex and not as a subdomain of `co.uk`.
 * Not a full public suffix list — it covers the cases churches actually
 * register, and being wrong only means we suggest a CNAME where an A record
 * would also have worked.
 */
const MULTI_PART_SUFFIXES = [
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "com.au",
  "org.au",
  "net.au",
  "co.nz",
  "org.nz",
  "co.za",
  "org.za",
  "com.br",
  "com.mx",
  "co.in",
  "org.in",
  "com.sg",
  "co.ke",
  "com.ng",
  "com.ph",
];

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type HostnameProblem =
  | "empty"
  | "too_long"
  | "invalid_characters"
  | "needs_dot"
  | "wildcard"
  | "platform_domain"
  | "local";

const PROBLEM_MESSAGES: Record<HostnameProblem, string> = {
  empty: "Enter a domain.",
  too_long: "That domain is too long.",
  invalid_characters:
    "Use only letters, numbers, dots, and hyphens — for example gracechurch.org.",
  needs_dot: "Enter a full domain, like gracechurch.org or www.gracechurch.org.",
  wildcard: "Wildcard domains are not supported.",
  platform_domain: `${PLATFORM_ROOT_DOMAIN} addresses are managed for you — you already have one.`,
  local: "That is a local address and cannot be pointed at your site.",
};

export function hostnameProblemMessage(problem: HostnameProblem): string {
  return PROBLEM_MESSAGES[problem];
}

/** Strips scheme, path, port, trailing dot, and case. */
export function normalizeHostname(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("@").pop() ?? value;
  value = value.split(":")[0];
  return value.replace(/\.$/, "");
}

export function validateHostname(
  input: string
): { ok: true; hostname: string } | { ok: false; problem: HostnameProblem } {
  const hostname = normalizeHostname(input);

  if (!hostname) return { ok: false, problem: "empty" };
  if (hostname.length > 253) return { ok: false, problem: "too_long" };
  if (hostname.includes("*")) return { ok: false, problem: "wildcard" };
  if (!hostname.includes(".")) return { ok: false, problem: "needs_dot" };

  const labels = hostname.split(".");
  if (!labels.every((label) => LABEL.test(label))) {
    return { ok: false, problem: "invalid_characters" };
  }

  // An all-numeric final label means this is an IP address, not a domain.
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return { ok: false, problem: "local" };
  }
  if (hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { ok: false, problem: "local" };
  }
  if (
    hostname === PLATFORM_ROOT_DOMAIN ||
    hostname.endsWith(`.${PLATFORM_ROOT_DOMAIN}`)
  ) {
    return { ok: false, problem: "platform_domain" };
  }

  return { ok: true, hostname };
}

export const hostnameSchema = z.string().transform((value, ctx) => {
  const result = validateHostname(value);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: hostnameProblemMessage(result.problem) });
    return z.NEVER;
  }
  return result.hostname;
});

/** True when the hostname is the registrable domain itself, not a subdomain. */
export function isApex(hostname: string): boolean {
  const suffix = MULTI_PART_SUFFIXES.find((candidate) =>
    hostname.endsWith(`.${candidate}`)
  );
  const expectedLabels = suffix ? suffix.split(".").length + 1 : 2;
  return hostname.split(".").length === expectedLabels;
}

export type DnsRecord = {
  type: "A" | "CNAME" | "TXT";
  /** What to type in the DNS host/name field. */
  name: string;
  value: string;
  note?: string;
};

/**
 * The records a church needs to add at their registrar.
 *
 * Apex domains get an A record because a CNAME at the zone apex is invalid in
 * DNS; subdomains get a CNAME so the target can change without the church
 * touching anything again.
 */
export function dnsRecordsFor(hostname: string): DnsRecord[] {
  if (isApex(hostname)) {
    return [
      {
        type: "A",
        name: "@",
        value: VERCEL_APEX_IP,
        note: "Some registrars write the root as a blank name instead of @.",
      },
    ];
  }

  const subdomain = hostname.split(".")[0];
  return [
    {
      type: "CNAME",
      name: subdomain,
      value: VERCEL_CNAME_TARGET,
      note: `Creates ${hostname}. Enter only "${subdomain}", not the whole domain.`,
    },
  ];
}

/**
 * The registrable domain a hostname belongs to.
 *
 * `www.gracechurch.org` and `gracechurch.org` share one — which is what lets
 * the UI show a church a single "gracechurch.org" entry instead of two rows
 * they have to reason about separately.
 */
export function registrableDomain(hostname: string): string {
  if (isApex(hostname)) return hostname;
  const suffix = MULTI_PART_SUFFIXES.find((candidate) =>
    hostname.endsWith(`.${candidate}`)
  );
  const keep = suffix ? suffix.split(".").length + 1 : 2;
  return hostname.split(".").slice(-keep).join(".");
}

/**
 * Every hostname to attach when a church asks for one domain.
 *
 * A church that types `gracechurch.org` means "our website should be at our
 * domain", and a visitor who types `www.` in front must not get an error. So the
 * apex and its `www.` are always connected as a pair, in whichever order they
 * were given — there is no version of this a church would sensibly decline, and
 * asking made them guess at DNS trivia.
 *
 * Deeper subdomains (`give.gracechurch.org`) stand alone: there is no
 * conventional partner for them.
 */
export function pairedHostnames(hostname: string): string[] {
  if (isApex(hostname)) return [hostname, `www.${hostname}`];

  const root = registrableDomain(hostname);
  if (hostname === `www.${root}`) return [root, hostname];

  return [hostname];
}
