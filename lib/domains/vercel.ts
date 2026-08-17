/**
 * Thin client over the Vercel Domains API.
 *
 * Only the five calls this product needs, and no state of its own: the database
 * is the record of which hostnames belong to which site, and Vercel is the
 * record of whether a hostname is verified and correctly pointed. Everything
 * here re-reads from Vercel rather than inferring, for the same reason the
 * billing module re-reads from Stripe — the two systems drift the moment you
 * start guessing.
 *
 * Every function returns a result object rather than throwing on a 4xx, because
 * "this domain is already used by another Vercel account" is an outcome the UI
 * has to explain, not an exception.
 */

const API = "https://api.vercel.com";

export type VercelVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type VercelDomain = {
  name: string;
  verified: boolean;
  verification: VercelVerification[];
};

export type VercelConfig = {
  /** Vercel's own verdict on whether the DNS records resolve correctly. */
  misconfigured: boolean;
};

export type VercelResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

export class VercelNotConfiguredError extends Error {
  constructor() {
    super(
      "Custom domains are not configured on this deployment. Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID."
    );
    this.name = "VercelNotConfiguredError";
  }
}

/** Whether the feature can work at all. The UI checks this before offering it. */
export function isCustomDomainsEnabled(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function credentials() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) throw new VercelNotConfiguredError();
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

function withTeam(path: string, teamId?: string): string {
  if (!teamId) return `${API}${path}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${API}${path}${separator}teamId=${encodeURIComponent(teamId)}`;
}

type ErrorBody = { error?: { code?: string; message?: string } };

async function call<T>(
  path: string,
  init: RequestInit & { teamId?: string; token: string }
): Promise<VercelResult<T>> {
  const { teamId, token, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(withTeam(path, teamId), {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      // Domain state changes out of band; a cached answer would show a church
      // "pending" long after their DNS went live.
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[vercel] request to ${path} failed`, error);
    return {
      ok: false,
      code: "network_error",
      message: "Could not reach Vercel. Try again in a moment.",
      status: 0,
    };
  }

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & ErrorBody) : ({} as T & ErrorBody);

  if (!response.ok) {
    const code = body.error?.code ?? `http_${response.status}`;
    return {
      ok: false,
      code,
      message: body.error?.message ?? "Vercel rejected the request.",
      status: response.status,
    };
  }

  return { ok: true, data: body as T };
}

/**
 * Attaches a hostname to the project.
 *
 * `domain_already_in_use` is the interesting failure: the hostname is attached
 * to a different Vercel project or account. That is not resolvable from here —
 * the owner has to remove it — so the message has to say so plainly.
 */
export async function addDomainToProject(
  hostname: string
): Promise<VercelResult<VercelDomain>> {
  const { token, projectId, teamId } = credentials();
  return call<VercelDomain>(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: hostname }),
    token,
    teamId,
  });
}

export async function removeDomainFromProject(
  hostname: string
): Promise<VercelResult<void>> {
  const { token, projectId, teamId } = credentials();
  return call<void>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    { method: "DELETE", token, teamId }
  );
}

export async function getProjectDomain(
  hostname: string
): Promise<VercelResult<VercelDomain>> {
  const { token, projectId, teamId } = credentials();
  return call<VercelDomain>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    { method: "GET", token, teamId }
  );
}

/** Asks Vercel to re-check the TXT challenge for a claimed domain. */
export async function verifyProjectDomain(
  hostname: string
): Promise<VercelResult<VercelDomain>> {
  const { token, projectId, teamId } = credentials();
  return call<VercelDomain>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}/verify`,
    { method: "POST", token, teamId }
  );
}

/** Whether the customer's DNS records actually resolve to Vercel. */
export async function getDomainConfig(
  hostname: string
): Promise<VercelResult<VercelConfig>> {
  const { token, teamId } = credentials();
  return call<VercelConfig>(
    `/v6/domains/${encodeURIComponent(hostname)}/config`,
    { method: "GET", token, teamId }
  );
}

/** Failure codes worth translating into copy a church can act on. */
export function explainVercelError(code: string, hostname: string): string {
  switch (code) {
    case "domain_already_in_use":
    case "domain_taken":
      return `${hostname} is already connected to another Vercel project. Remove it there first, or use a subdomain like www.${hostname}.`;
    case "forbidden":
      return "This deployment is not allowed to manage domains. Check the Vercel API token.";
    case "invalid_domain":
      return `${hostname} is not a valid domain name.`;
    case "domain_not_found":
      return `${hostname} is not connected to this project.`;
    case "network_error":
      return "Could not reach Vercel. Try again in a moment.";
    default:
      return `Vercel could not add ${hostname} (${code}).`;
  }
}
