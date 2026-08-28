import { GHL_API_BASE, GHL_API_VERSION, type GhlConfig } from "./config";

/**
 * The two GoHighLevel calls this app makes, per `ghl.md`:
 * `POST /locations/` (create a sub-account) and `POST /users/` (create the
 * matching user inside it).
 *
 * Written directly against `fetch` rather than pulling in
 * `@gohighlevel/api-client` — two request shapes do not justify a dependency,
 * and doing it here keeps the exact fields visible next to the spec they came
 * from. Both endpoints require the `Version` header; omitting it is a 4xx.
 */

export class GhlApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string
  ) {
    super(message);
    this.name = "GhlApiError";
  }
}

/** GHL error bodies are `{ message, statusCode }`, but not reliably — fall back to the raw text. */
async function readError(response: Response, endpoint: string): Promise<GhlApiError> {
  const raw = await response.text().catch(() => "");
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message)) message = parsed.message.join("; ");
  } catch {
    // Not JSON — the raw body is the best message available.
  }

  return new GhlApiError(
    message.slice(0, 300) || `GHL ${endpoint} failed with ${response.status}`,
    response.status,
    endpoint
  );
}

/**
 * The search endpoints answer to the dated API version, not `v3` (which the
 * two create endpoints require). Kept separate so neither drifts onto the
 * other's version by accident.
 */
const GHL_SEARCH_VERSION = "2021-07-28";

async function get<T>(config: GhlConfig, path: string): Promise<T> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      Version: GHL_SEARCH_VERSION,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw await readError(response, path);

  return (await response.json()) as T;
}

async function post<T>(
  config: GhlConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${GHL_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      Version: GHL_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    // Never cached: these are account-creating writes.
    cache: "no-store",
  });

  if (!response.ok) throw await readError(response, endpoint);

  return (await response.json()) as T;
}

export type CreateLocationInput = {
  name: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** Returns the new sub-account's id (`locationId`). */
export async function createLocation(
  config: GhlConfig,
  input: CreateLocationInput
): Promise<string> {
  const result = await post<{ id?: string }>(config, "/locations/", {
    name: input.name,
    companyId: config.companyId,
    email: input.email,
    country: config.defaultCountry,
    timezone: config.defaultTimezone,
    prospectInfo: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    },
  });

  if (!result.id) {
    throw new GhlApiError("GHL created a location but returned no id", 502, "/locations/");
  }
  return result.id;
}

export type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locationId: string;
  /**
   * The link back from GHL to this app — but specifically the CLERK user id
   * (`User.clerkId`), not our internal `User.id`. GHL's SSO login matches
   * users by this field against the OIDC `sub` claim the IdP returns, and
   * Clerk (the IdP) asserts `sub` as its own user id. See GHL-SSO-PLAN.md.
   */
  externalUserId: string;
};

/**
 * Every user this app provisions is a church admin whose only reason to be
 * in GHL at all is Membership (Courses), Marketing, Conversations, and
 * Contacts — everything else in GHL's admin surface (workflows, funnels,
 * payments, settings, reporting, social planner, ...) is switched off so a
 * church admin never lands on a GHL feature this app doesn't support or
 * explain. One constant because this app only ever creates this one kind of
 * user — there is no per-call variation to plumb through `CreateUserInput`.
 */
const SCOPED_PERMISSIONS = {
  campaignsEnabled: false,
  campaignsReadOnly: false,
  contactsEnabled: true,
  workflowsEnabled: false,
  workflowsReadOnly: false,
  triggersEnabled: false,
  funnelsEnabled: false,
  websitesEnabled: false,
  opportunitiesEnabled: false,
  dashboardStatsEnabled: false,
  bulkRequestsEnabled: false,
  appointmentsEnabled: false,
  reviewsEnabled: false,
  onlineListingsEnabled: false,
  phoneCallEnabled: false,
  conversationsEnabled: true,
  assignedDataOnly: false,
  adwordsReportingEnabled: false,
  membershipEnabled: true,
  facebookAdsReportingEnabled: false,
  attributionsReportingEnabled: false,
  settingsEnabled: false,
  tagsEnabled: false,
  leadValueEnabled: false,
  marketingEnabled: true,
  agentReportingEnabled: false,
  botService: false,
  socialPlanner: false,
  bloggingEnabled: false,
  invoiceEnabled: false,
  affiliateManagerEnabled: false,
  contentAiEnabled: false,
  refundsEnabled: false,
  recordPaymentEnabled: false,
  cancelSubscriptionEnabled: false,
  paymentsEnabled: false,
  communitiesEnabled: false,
  exportPaymentsEnabled: false,
} as const;

/** Returns the new GHL user's id. */
export async function createUser(
  config: GhlConfig,
  input: CreateUserInput
): Promise<string> {
  const result = await post<{ id?: string }>(config, "/users/", {
    companyId: config.companyId,
    email: input.email,
    password: input.password,
    type: "account",
    // "user", not "admin": GHL's `permissions` toggles below only mean
    // anything for a non-admin role — an admin user is commonly not gated
    // by them at all, which would make every `false` below a no-op.
    role: "user",
    locationIds: [input.locationId],
    firstName: input.firstName,
    lastName: input.lastName,
    externalUserId: input.externalUserId,
    permissions: SCOPED_PERMISSIONS,
  });

  if (!result.id) {
    throw new GhlApiError("GHL created a user but returned no id", 502, "/users/");
  }
  return result.id;
}

function sameEmail(a: string | undefined, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * An existing sub-account for this email, if the agency already has one.
 *
 * Checked BEFORE creating, because sub-accounts are billable and our own
 * record of one can go missing (a restored backup, a wiped dev database) —
 * without this, every such loss silently buys another Location.
 */
export async function findLocationByEmail(
  config: GhlConfig,
  email: string
): Promise<string | null> {
  const result = await get<{ locations?: Array<{ id?: string; email?: string }> }>(
    config,
    `/locations/search?limit=100`
  );
  const match = (result.locations ?? []).find((l) => sameEmail(l.email, email));
  return match?.id ?? null;
}

/**
 * An existing GHL user for this email.
 *
 * GHL enforces email uniqueness across users, so `POST /users/` fails with
 * "A user with this email already exists" rather than returning the existing
 * one. Adopting it is the only way provisioning can recover.
 */
export async function findUserByEmail(
  config: GhlConfig,
  email: string
): Promise<string | null> {
  const result = await get<{ users?: Array<{ id?: string; email?: string; deleted?: boolean }> }>(
    config,
    `/users/search?companyId=${encodeURIComponent(config.companyId)}&limit=100`
  );
  const match = (result.users ?? []).find((u) => !u.deleted && sameEmail(u.email, email));
  return match?.id ?? null;
}

/** True for the specific GHL rejection that means "this email is already taken". */
export function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof GhlApiError &&
    /already exists/i.test(error.message)
  );
}

export type GhlClient = {
  createLocation: typeof createLocation;
  createUser: typeof createUser;
  findLocationByEmail: typeof findLocationByEmail;
  findUserByEmail: typeof findUserByEmail;
};

/** The real client. Swapped for a fake in tests so no live sub-accounts are created. */
export const ghlClient: GhlClient = {
  createLocation,
  createUser,
  findLocationByEmail,
  findUserByEmail,
};
