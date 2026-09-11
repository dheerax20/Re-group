import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The GoHighLevel OAuth credential chain.
 *
 * The agency Private Integration Token cannot reach location-scoped endpoints
 * — `/contacts/*` and `/oauth/locationToken` both answer it with
 * `401 The token is not authorized for this scope` — so contacts run on an
 * OAuth agency token exchanged for a per-church sub-account token. These tests
 * cover the parts of that chain that are easy to get subtly wrong: which token
 * is reused, when a refresh happens, and that nothing is stored in the clear.
 */

type Row = {
  id: string;
  companyId: string;
  locationId: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string | null;
  userType: string;
};

const rows = new Map<string, Row>();

vi.mock("@/lib/db", () => ({
  prisma: {
    ghlOAuthToken: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...rows.values()].find(
          (row) =>
            row.companyId === where.companyId &&
            row.locationId === (where.locationId ?? null)
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { id: string };
        create: Row;
        update: Partial<Row>;
      }) => {
        const existing = rows.get(where.id);
        const next = existing ? { ...existing, ...update } : create;
        rows.set(where.id, next as Row);
        return next;
      },
      deleteMany: async ({ where }: { where: { locationId: string } }) => {
        for (const [key, row] of rows) {
          if (row.locationId === where.locationId) rows.delete(key);
        }
        return { count: 1 };
      },
      count: async () => 0,
    },
  },
}));

const oauth = await import("@/lib/ghl/oauth");
const { decryptToken, encryptToken } = await import("@/lib/ghl/crypto");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function tokenResponse(body: Record<string, unknown>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function seedAgency(expiresAt: Date) {
  rows.set("agency:company-1", {
    id: "agency:company-1",
    companyId: "company-1",
    locationId: null,
    accessToken: encryptToken("agency-access"),
    refreshToken: encryptToken("agency-refresh"),
    expiresAt,
    scope: null,
    userType: "Company",
  });
}

beforeEach(() => {
  rows.clear();
  fetchMock.mockReset();
  process.env.GHL_TOKEN = "pit-token";
  process.env.GHL_COMPANY_ID = "company-1";
  process.env.GHL_OAUTH_CLIENT_ID = "client-id";
  process.env.GHL_OAUTH_CLIENT_SECRET = "client-secret";
  process.env.GHL_TOKEN_ENCRYPTION_KEY = "test-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://regroup.app";
});

describe("configuration", () => {
  it("is off until both client credentials are set", () => {
    delete process.env.GHL_OAUTH_CLIENT_SECRET;
    expect(oauth.isGhlOAuthConfigured()).toBe(false);

    process.env.GHL_OAUTH_CLIENT_SECRET = "client-secret";
    expect(oauth.isGhlOAuthConfigured()).toBe(true);
  });

  it("asks for the scopes the exchange endpoint actually gates on", () => {
    const url = oauth.ghlAuthorizeUrl("state-value");
    // `oauth.write` is what /oauth/locationToken requires; without it the
    // install completes and then every mint returns 401.
    expect(url).toContain("oauth.write");
    expect(url).toContain("contacts.write");
    expect(url).toContain(encodeURIComponent("https://regroup.app/api/ghl/oauth/callback"));
  });
});

describe("install state", () => {
  it("round-trips and rejects tampering", () => {
    const state = oauth.signOAuthState("user-1");
    expect(oauth.verifyOAuthState(state)).toEqual({ userId: "user-1" });

    expect(oauth.verifyOAuthState(`${state}x`)).toBeNull();
    expect(oauth.verifyOAuthState("garbage")).toBeNull();
  });

  it("cannot be forged with a different client secret", () => {
    const state = oauth.signOAuthState("user-1");
    process.env.GHL_OAUTH_CLIENT_SECRET = "someone-elses-secret";
    expect(oauth.verifyOAuthState(state)).toBeNull();
  });
});

describe("exchangeAuthorizationCode", () => {
  it("asks for a Company token and stores the pair encrypted", async () => {
    fetchMock.mockResolvedValueOnce(
      tokenResponse({
        access_token: "agency-access",
        refresh_token: "agency-refresh",
        expires_in: 86399,
        userType: "Company",
        companyId: "company-1",
      })
    );

    const result = await oauth.exchangeAuthorizationCode("the-code");

    expect(result.companyId).toBe("company-1");
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("user_type=Company");
    expect(body).toContain("grant_type=authorization_code");

    const stored = rows.get("agency:company-1")!;
    // Nothing readable in the column, but recoverable with the key.
    expect(stored.accessToken).not.toContain("agency-access");
    expect(decryptToken(stored.accessToken)).toBe("agency-access");
    expect(decryptToken(stored.refreshToken)).toBe("agency-refresh");
  });

  it("writes the agency row under a deterministic id, so a re-install replaces it", async () => {
    const response = () =>
      tokenResponse({
        access_token: "a",
        refresh_token: "b",
        expires_in: 3600,
        userType: "Company",
        companyId: "company-1",
      });
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response());

    await oauth.exchangeAuthorizationCode("code-1");
    await oauth.exchangeAuthorizationCode("code-2");

    // Postgres does not enforce @@unique across NULL locationId, which is why
    // the id is derived rather than generated.
    expect(rows.size).toBe(1);
  });
});

describe("getAgencyAccessToken", () => {
  it("reports a missing install distinctly from a transient failure", async () => {
    await expect(oauth.getAgencyAccessToken()).rejects.toBeInstanceOf(
      oauth.GhlOAuthNotConnectedError
    );
  });

  it("reuses a live token without calling GHL", async () => {
    seedAgency(new Date(Date.now() + 60 * 60 * 1000));

    await expect(oauth.getAgencyAccessToken()).resolves.toBe("agency-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and keeps the rotated refresh token", async () => {
    seedAgency(new Date(Date.now() - 1000));
    fetchMock.mockResolvedValueOnce(
      tokenResponse({
        access_token: "fresh-access",
        refresh_token: "rotated-refresh",
        expires_in: 86399,
      })
    );

    await expect(oauth.getAgencyAccessToken()).resolves.toBe("fresh-access");

    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=refresh_token");
    // GHL rotates on every use, so keeping the old one would break the NEXT
    // refresh rather than this one.
    expect(decryptToken(rows.get("agency:company-1")!.refreshToken)).toBe("rotated-refresh");
  });
});

describe("getLocationAccessToken", () => {
  it("mints from the agency token and caches the result", async () => {
    seedAgency(new Date(Date.now() + 60 * 60 * 1000));
    fetchMock.mockResolvedValueOnce(
      tokenResponse({
        access_token: "location-access",
        refresh_token: "location-refresh",
        expires_in: 86400,
      })
    );

    await expect(oauth.getLocationAccessToken("loc_1")).resolves.toBe("location-access");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/oauth/locationToken");
    expect(init.headers.Authorization).toBe("Bearer agency-access");
    expect(String(init.body)).toContain("locationId=loc_1");

    // Second call is served from Postgres.
    fetchMock.mockClear();
    await expect(oauth.getLocationAccessToken("loc_1")).resolves.toBe("location-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the hyphenated path if the documented one 404s", async () => {
    seedAgency(new Date(Date.now() + 60 * 60 * 1000));
    fetchMock
      .mockResolvedValueOnce(tokenResponse({}, 404))
      .mockResolvedValueOnce(
        tokenResponse({ access_token: "x", refresh_token: "y", expires_in: 3600 })
      );

    await expect(oauth.getLocationAccessToken("loc_1")).resolves.toBe("x");
    expect(fetchMock.mock.calls[1][0]).toContain("/oauth/location-token");
  });

  it("surfaces the scope error rather than storing an empty token", async () => {
    seedAgency(new Date(Date.now() + 60 * 60 * 1000));
    fetchMock.mockResolvedValueOnce(
      tokenResponse({ statusCode: 401, message: "The token is not authorized for this scope." }, 401)
    );

    await expect(oauth.getLocationAccessToken("loc_1")).rejects.toThrow(/not authorized/i);
    expect(rows.has("location:loc_1")).toBe(false);
  });

  it("forgetting a location drops its stored token", async () => {
    seedAgency(new Date(Date.now() + 60 * 60 * 1000));
    fetchMock.mockResolvedValueOnce(
      tokenResponse({ access_token: "x", refresh_token: "y", expires_in: 3600 })
    );
    await oauth.getLocationAccessToken("loc_1");
    expect(rows.has("location:loc_1")).toBe(true);

    await oauth.forgetLocationToken("loc_1");
    expect(rows.has("location:loc_1")).toBe(false);
  });
});
