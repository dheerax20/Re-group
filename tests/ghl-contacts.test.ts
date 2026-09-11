import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Member -> GoHighLevel contact sync.
 *
 * The property under test throughout is that this NEVER throws: a church admin
 * adding someone standing in front of them must not be shown an error because
 * a third party is down. Every failure has to land on the row as a status
 * instead, which is what the retry button reads.
 */

const memberRow = {
  id: "m1",
  firstName: "Ann-Marie",
  lastName: "O'Neill",
  email: "ann@example.com",
  phone: null as string | null,
  status: "VISITOR" as const,
  site: { userId: "u1" },
};

const updates: Array<Record<string, unknown>> = [];
const findUnique = vi.fn(async () => memberRow as unknown);

vi.mock("@/lib/db", () => ({
  prisma: {
    member: {
      findUnique: (...args: unknown[]) => findUnique(...(args as [])),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return data;
      },
    },
  },
}));

const getLocationAccessToken = vi.fn(async () => "tok_1");
const forgetLocationToken = vi.fn(async () => {});
let oauthConfigured = true;

vi.mock("@/lib/ghl/oauth", () => ({
  getLocationAccessToken: (...args: unknown[]) => getLocationAccessToken(...(args as [])),
  forgetLocationToken: (...args: unknown[]) => forgetLocationToken(...(args as [])),
  isGhlOAuthConfigured: () => oauthConfigured,
}));

const ensureGhlAccount = vi.fn(async () => ({
  ok: true as const,
  locationId: "loc_1",
  ghlUserId: "usr_1",
  alreadyExisted: true,
}));

vi.mock("@/lib/ghl/provision", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ghl/provision")>(
    "@/lib/ghl/provision"
  );
  return { ...actual, ensureGhlAccount: (...args: unknown[]) => ensureGhlAccount(...(args as [])) };
});

const { syncMemberToGhl } = await import("@/lib/ghl/contacts");
type GhlClient = import("@/lib/ghl/client").GhlClient;
const { GhlApiError } = await import("@/lib/ghl/client");


/** A client that records calls and never touches the network. */
function fakeClient(overrides: Record<string, unknown> = {}): GhlClient {
  return {
    createLocation: vi.fn(),
    createUser: vi.fn(),
    findLocationByEmail: vi.fn(),
    findUserByEmail: vi.fn(),
    upsertContact: vi.fn(async () => "contact_1"),
    ...overrides,
  } as unknown as GhlClient;
}

function configure() {
  process.env.GHL_TOKEN = "agency-token";
  process.env.GHL_COMPANY_ID = "company-1";
}

beforeEach(() => {
  updates.length = 0;
  oauthConfigured = true;
  getLocationAccessToken.mockClear();
  getLocationAccessToken.mockResolvedValue("tok_1");
  forgetLocationToken.mockClear();
  delete process.env.GHL_TOKEN;
  delete process.env.GHL_COMPANY_ID;
  findUnique.mockResolvedValue(memberRow as unknown);
  ensureGhlAccount.mockResolvedValue({
    ok: true,
    locationId: "loc_1",
    ghlUserId: "usr_1",
    alreadyExisted: true,
  });
});

describe("syncMemberToGhl", () => {
  it("skips with no HTTP calls when GoHighLevel is not configured", async () => {
    const client = fakeClient();
    const result = await syncMemberToGhl("m1", client);

    expect(result.status).toBe("SKIPPED");
    expect(getLocationAccessToken).not.toHaveBeenCalled();
    expect(client.upsertContact).not.toHaveBeenCalled();
    expect(updates.at(-1)?.syncStatus).toBe("SKIPPED");
  });

  it("skips a member GHL could never accept, rather than failing", async () => {
    configure();
    findUnique.mockResolvedValue({ ...memberRow, email: null, phone: null } as unknown);

    const client = fakeClient();
    const result = await syncMemberToGhl("m1", client);

    expect(result.status).toBe("SKIPPED");
    expect(result.reason).toMatch(/email or phone/i);
    expect(client.upsertContact).not.toHaveBeenCalled();
  });

  it("upserts the contact into the owner's location and stores the id", async () => {
    configure();
    const client = fakeClient();
    const result = await syncMemberToGhl("m1", client);

    expect(result).toMatchObject({ status: "SYNCED", contactId: "contact_1" });
    expect(client.upsertContact).toHaveBeenCalledWith(
      expect.anything(),
      "tok_1",
      expect.objectContaining({
        locationId: "loc_1",
        firstName: "Ann-Marie",
        email: "ann@example.com",
        tags: ["regroup", "regroup-visitor"],
      })
    );
    expect(updates.at(-1)).toMatchObject({
      syncStatus: "SYNCED",
      ghlContactId: "contact_1",
    });
  });

  it("records a failure instead of throwing when GHL rejects the contact", async () => {
    configure();
    const client = fakeClient({
      upsertContact: vi.fn(async () => {
        throw new GhlApiError("Invalid phone number", 422, "/contacts/upsert");
      }),
    });

    const result = await syncMemberToGhl("m1", client);

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("Invalid phone number");
    expect(updates.at(-1)).toMatchObject({
      syncStatus: "FAILED",
      syncError: "Invalid phone number",
    });
  });

  it("re-mints the location token once on a 401 and succeeds on the retry", async () => {
    configure();
    let attempt = 0;
    const client = fakeClient({
      upsertContact: vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new GhlApiError("Unauthorized", 401, "/contacts/upsert");
        }
        return "contact_2";
      }),
    });

    const result = await syncMemberToGhl("m1", client);

    expect(result).toMatchObject({ status: "SYNCED", contactId: "contact_2" });
    // Once for the stale token, once after `forgetLocationToken` cleared it.
    expect(forgetLocationToken).toHaveBeenCalledWith("loc_1");
    expect(getLocationAccessToken).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry rather than looping on a real permission problem", async () => {
    configure();
    const client = fakeClient({
      upsertContact: vi.fn(async () => {
        throw new GhlApiError("Forbidden", 403, "/contacts/upsert");
      }),
    });

    const result = await syncMemberToGhl("m1", client);

    expect(result.status).toBe("FAILED");
    expect(client.upsertContact).toHaveBeenCalledTimes(2);
  });

  it("carries a provisioning skip through as SKIPPED, not FAILED", async () => {
    configure();
    ensureGhlAccount.mockResolvedValue({
      ok: false,
      reason: "GoHighLevel is not configured",
      skipped: true,
    } as never);

    const result = await syncMemberToGhl("m1", fakeClient());

    expect(result.status).toBe("SKIPPED");
  });

  it("fails when the site has no owner to sync through", async () => {
    configure();
    findUnique.mockResolvedValue({ ...memberRow, site: { userId: null } } as unknown);

    const result = await syncMemberToGhl("m1", fakeClient());

    expect(result.status).toBe("FAILED");
    expect(result.reason).toMatch(/no owner/i);
  });
});

describe("OAuth gating", () => {
  it("skips when the contact half of the integration is not configured", async () => {
    configure();
    oauthConfigured = false;

    const client = fakeClient();
    const result = await syncMemberToGhl("m1", client);

    expect(result.status).toBe("SKIPPED");
    expect(result.reason).toMatch(/not configured/i);
    expect(client.upsertContact).not.toHaveBeenCalled();
  });

  it("fails, retryably, when the app is configured but never installed", async () => {
    configure();
    getLocationAccessToken.mockRejectedValue(
      new Error("The GoHighLevel app has not been connected yet")
    );

    const result = await syncMemberToGhl("m1", fakeClient());

    expect(result.status).toBe("FAILED");
    expect(result.reason).toMatch(/not been connected/i);
  });
});
