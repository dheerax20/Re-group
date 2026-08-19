/**
 * GoHighLevel deployment configuration.
 *
 * The integration is OPTIONAL: with nothing set, `resolveGhlConfig()` returns
 * null and provisioning becomes a no-op, so local development and any
 * deployment that isn't using GHL keeps working unchanged. Same posture as
 * `resolveGateway()` in `lib/ai/agents/model-config.ts` — an unset provider
 * means "this feature is off", never a crash on an unrelated code path.
 */

export type GhlConfig = {
  /** Agency-level Private Integration Token (`GHL_TOKEN`), or an OAuth access token. */
  apiToken: string;
  /** The agency's company id, sent as `companyId` on both create calls. */
  companyId: string;
  /** 2-letter country code for new sub-accounts. */
  defaultCountry: string;
  defaultTimezone: string;
};

/** Where the Courses button hands off to. Overridable per deployment. */
export const COURSES_SSO_URL =
  process.env.COURSES_SSO_URL?.trim() || "https://app.squibb.ink/login/sso";

/** GHL requires this header on every v3 call; wrong or missing means a 4xx. */
export const GHL_API_VERSION = "v3";

export const GHL_API_BASE = "https://services.leadconnectorhq.com";

export function resolveGhlConfig(): GhlConfig | null {
  const apiToken = process.env.GHL_TOKEN?.trim();
  const companyId = process.env.GHL_COMPANY_ID?.trim();
  if (!apiToken || !companyId) return null;

  return {
    apiToken,
    companyId,
    defaultCountry: process.env.GHL_DEFAULT_COUNTRY?.trim() || "US",
    defaultTimezone: process.env.GHL_DEFAULT_TIMEZONE?.trim() || "US/Central",
  };
}

export function isGhlConfigured(): boolean {
  return resolveGhlConfig() !== null;
}
