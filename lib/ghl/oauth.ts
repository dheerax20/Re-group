import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { GHL_API_BASE, GHL_API_VERSION, resolveGhlConfig } from "./config";
import { decryptToken, encryptToken } from "./crypto";

/**
 * The GoHighLevel OAuth credential chain.
 *
 * Why this exists at all: the agency Private Integration Token in `GHL_TOKEN`
 * creates sub-accounts and users perfectly well, but every location-scoped
 * endpoint answers it with `401 The token is not authorized for this scope` —
 * `/contacts/*` and, critically, `/oauth/locationToken` itself, so it cannot
 * even be exchanged for a token that would work. Verified against the live
 * API on both documented paths and both API versions.
 *
 * So there are two credentials, doing different jobs, and both are kept:
 *
 *   PIT (`GHL_TOKEN`)          -> POST /locations/, POST /users/   (provisioning)
 *   OAuth agency token          -> POST /oauth/locationToken        (this file)
 *     └─ location token         -> POST /contacts/upsert            (member sync)
 *
 * Nothing about provisioning changes. `ensureGhlAccount` still runs on the
 * PIT, the 14 existing sub-accounts keep their `locationId`s, and this module
 * only supplies the credential the contact calls need.
 *
 * Optional, like every other integration here: with no client id or secret
 * configured, `resolveGhlOAuthConfig()` returns null and member sync records
 * SKIPPED instead of failing.
 */

export type GhlOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * `oauth.write` is what `/oauth/locationToken` gates on; the contact scopes are
 * what the minted location token carries forward. Requested at install time,
 * so changing this list means re-installing the app, not just a deploy.
 */
export const GHL_OAUTH_SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "locations.readonly",
  "oauth.write",
  "oauth.readonly",
] as const;

export function ghlRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/api/ghl/oauth/callback`;
}

export function resolveGhlOAuthConfig(): GhlOAuthConfig | null {
  const clientId = process.env.GHL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return { clientId, clientSecret, redirectUri: ghlRedirectUri() };
}

export function isGhlOAuthConfigured(): boolean {
  return resolveGhlOAuthConfig() !== null;
}

/** Where the agency owner is sent to authorize the app. */
export function ghlAuthorizeUrl(state: string): string {
  const config = resolveGhlOAuthConfig();
  if (!config) throw new Error("GoHighLevel OAuth is not configured.");

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    scope: GHL_OAUTH_SCOPES.join(" "),
    state,
  });
  return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* state                                                                       */
/* -------------------------------------------------------------------------- */

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Same stateless, signed `state` as the Slack flow (`lib/slack/state.ts`).
 *
 * This callback connects the PLATFORM's agency rather than one church, so
 * there is no siteId to carry — only proof that the callback answers an
 * authorize request this deployment issued, bounded by an expiry. The
 * signature is keyed by the client secret, which only this deployment knows.
 */
function stateKey(): string {
  const config = resolveGhlOAuthConfig();
  if (!config) throw new Error("GoHighLevel OAuth is not configured.");
  return config.clientSecret;
}

export function signOAuthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + STATE_TTL_MS }),
    "utf8"
  ).toString("base64url");
  const signature = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(token: string): { userId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.userId !== "string" || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* token endpoints                                                             */
/* -------------------------------------------------------------------------- */

export type GhlTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
};

async function postForm(path: string, body: URLSearchParams, bearer?: string) {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      Version: GHL_API_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });
  return response;
}

async function readTokenResponse(
  response: Response,
  path: string
): Promise<GhlTokenResponse> {
  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`GHL ${path} returned ${response.status}: ${raw.slice(0, 300)}`);
  }

  let parsed: GhlTokenResponse;
  try {
    parsed = JSON.parse(raw) as GhlTokenResponse;
  } catch {
    throw new Error(`GHL ${path} returned a non-JSON body: ${raw.slice(0, 200)}`);
  }

  if (!parsed.access_token || !parsed.refresh_token) {
    throw new Error(`GHL ${path} returned no token pair.`);
  }
  return parsed;
}

/**
 * Persists one token pair.
 *
 * The agency row gets a DETERMINISTIC id rather than a cuid, because
 * `@@unique([companyId, locationId])` does not constrain it: Postgres treats
 * every NULL as distinct, so two installs would otherwise create two agency
 * rows and half the app would read the stale one.
 */
async function store(params: {
  companyId: string;
  locationId: string | null;
  token: GhlTokenResponse;
  userType: string;
}): Promise<void> {
  const { companyId, locationId, token, userType } = params;
  const id = locationId ? `location:${locationId}` : `agency:${companyId}`;

  const data = {
    companyId,
    locationId,
    accessToken: encryptToken(token.access_token),
    refreshToken: encryptToken(token.refresh_token),
    // Deliberately conservative: a token treated as expiring sooner than it
    // does costs one refresh call, while the reverse costs a failed sync.
    expiresAt: new Date(Date.now() + Math.max(token.expires_in - 60, 60) * 1000),
    scope: token.scope ?? null,
    userType,
  };

  await prisma.ghlOAuthToken.upsert({ where: { id }, create: { id, ...data }, update: data });
}

/** Completes the install. Called once, by the agency owner, from the callback. */
export async function exchangeAuthorizationCode(code: string): Promise<{
  companyId: string;
}> {
  const config = resolveGhlOAuthConfig();
  if (!config) throw new Error("GoHighLevel OAuth is not configured.");

  const token = await readTokenResponse(
    await postForm(
      "/oauth/token",
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        // The whole point of the install: `Company` is what yields an
        // agency-level token, which is the only kind `/oauth/locationToken`
        // will exchange. A `Location` token here would authorize one church.
        user_type: "Company",
        redirect_uri: config.redirectUri,
      })
    ),
    "/oauth/token"
  );

  // Prefer what GHL asserts about the token over what is configured — if they
  // disagree, the configured id is wrong and every later lookup would miss.
  const companyId = token.companyId ?? resolveGhlConfig()?.companyId;
  if (!companyId) {
    throw new Error("GHL returned no companyId for this install.");
  }

  await store({
    companyId,
    locationId: null,
    token,
    userType: token.userType ?? "Company",
  });
  return { companyId };
}

async function refresh(
  refreshToken: string,
  userType: string
): Promise<GhlTokenResponse> {
  const config = resolveGhlOAuthConfig();
  if (!config) throw new Error("GoHighLevel OAuth is not configured.");

  return readTokenResponse(
    await postForm(
      "/oauth/token",
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        user_type: userType,
      })
    ),
    "/oauth/token (refresh)"
  );
}

/** True while the stored token has enough life left to be worth using. */
function isFresh(expiresAt: Date): boolean {
  return expiresAt.getTime() > Date.now() + 60_000;
}

export class GhlOAuthNotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhlOAuthNotConnectedError";
  }
}

/**
 * The agency access token, refreshed if it has expired.
 *
 * Throws `GhlOAuthNotConnectedError` when the app has never been installed —
 * distinct from a transient failure, because the fix is a human clicking
 * through the install rather than a retry.
 */
export async function getAgencyAccessToken(): Promise<string> {
  const config = resolveGhlConfig();
  if (!config) throw new GhlOAuthNotConnectedError("GoHighLevel is not configured.");

  const row = await prisma.ghlOAuthToken.findFirst({
    where: { companyId: config.companyId, locationId: null },
  });
  if (!row) {
    throw new GhlOAuthNotConnectedError(
      "The GoHighLevel app has not been connected yet — visit /api/ghl/oauth/start to install it."
    );
  }

  if (isFresh(row.expiresAt)) return decryptToken(row.accessToken);

  // GHL rotates the refresh token on every use, so the new pair replaces the
  // old row rather than being appended alongside it.
  const token = await refresh(decryptToken(row.refreshToken), row.userType);
  await store({
    companyId: row.companyId,
    locationId: null,
    token,
    userType: row.userType,
  });
  return token.access_token;
}

/**
 * Mints a sub-account token from the agency token.
 *
 * GHL's docs give this endpoint as `/oauth/locationToken`, while some
 * references write it `/oauth/location-token`. Probing with an unauthorized
 * token returned 401 for both — auth is checked before routing, so that told
 * us nothing — hence the documented path first and the other on a 404.
 */
async function mintLocationToken(
  agencyToken: string,
  companyId: string,
  locationId: string
): Promise<GhlTokenResponse> {
  const body = new URLSearchParams({ companyId, locationId });

  let response = await postForm("/oauth/locationToken", body, agencyToken);
  if (response.status === 404) {
    response = await postForm("/oauth/location-token", body, agencyToken);
  }
  return readTokenResponse(response, "/oauth/locationToken");
}

/**
 * A valid access token for one church's sub-account.
 *
 * Cached in Postgres and reused until it expires, so adding ten members in a
 * sitting mints one token rather than ten. A stored token that GHL has already
 * invalidated surfaces as a 401 at the call site, which clears it and retries
 * once (`lib/ghl/contacts.ts`).
 */
export async function getLocationAccessToken(locationId: string): Promise<string> {
  const config = resolveGhlConfig();
  if (!config) throw new GhlOAuthNotConnectedError("GoHighLevel is not configured.");

  const row = await prisma.ghlOAuthToken.findFirst({
    where: { companyId: config.companyId, locationId },
  });
  if (row && isFresh(row.expiresAt)) return decryptToken(row.accessToken);

  // A location token can be refreshed like any other, but re-minting from the
  // agency token is equally cheap and cannot fail on a rotated refresh token,
  // so expiry always takes the mint path.
  const agencyToken = await getAgencyAccessToken();
  const token = await mintLocationToken(agencyToken, config.companyId, locationId);

  await store({
    companyId: config.companyId,
    locationId,
    token,
    userType: token.userType ?? "Location",
  });
  return token.access_token;
}

/** Drops a location's stored token, so the next call mints a fresh one. */
export async function forgetLocationToken(locationId: string): Promise<void> {
  await prisma.ghlOAuthToken
    .deleteMany({ where: { locationId } })
    .catch((error) => console.error(`[ghl] could not clear token for ${locationId}`, error));
}

/** What `ghl:check` and the settings screen report. */
export async function getOAuthConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  companyId?: string;
  expiresAt?: Date;
  locationTokens: number;
}> {
  const config = resolveGhlConfig();
  if (!config || !isGhlOAuthConfigured()) {
    return { configured: false, connected: false, locationTokens: 0 };
  }

  const [agency, locationTokens] = await Promise.all([
    prisma.ghlOAuthToken.findFirst({
      where: { companyId: config.companyId, locationId: null },
    }),
    prisma.ghlOAuthToken.count({
      where: { companyId: config.companyId, locationId: { not: null } },
    }),
  ]);

  return {
    configured: true,
    connected: Boolean(agency),
    companyId: config.companyId,
    expiresAt: agency?.expiresAt,
    locationTokens,
  };
}
