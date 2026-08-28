import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { resolveHostnameInProxy } from "@/lib/domains/proxy-resolve";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

/** Paths that belong to the platform itself and never to a tenant site. */
function isPlatformPath(pathname: string): boolean {
  return (
    pathname.startsWith("/sites") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

/**
 * Webhook endpoints that are unauthenticated by design: each verifies a
 * signature computed over the RAW request body, has no session to refresh
 * and no cookies to set. Returning before `clerkMiddleware()` runs keeps
 * anything session-related — including its own network call to Clerk — well
 * away from routes where the body must arrive byte-for-byte intact — a
 * re-encode invalidates every signature.
 *
 * EXACT match, never a prefix. `/api/slack/oauth/callback` sits under the
 * same namespace and genuinely needs the Clerk session, so a
 * `startsWith("/api/slack")` here would silently break connecting Slack.
 */
const RAW_BODY_WEBHOOKS = new Set([
  "/api/stripe/webhook",
  "/api/slack/commands",
  "/api/slack/events",
  "/api/slack/interactivity",
]);

/**
 * The tenant slug for a platform subdomain (`grace.regroup.app`), or null.
 * Custom domains are resolved separately, against the database.
 */
function slugFromPlatformHost(host: string): string | null {
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const candidate = host.slice(0, -1 * (ROOT_DOMAIN.length + 1));
    return candidate && candidate !== "www" ? candidate : null;
  }
  // Local development: grace.localhost:3000.
  if (host.endsWith(".localhost")) {
    const candidate = host.slice(0, -".localhost".length);
    return candidate && candidate !== "www" ? candidate : null;
  }
  return null;
}

/**
 * Multi-tenant hostname rewrites. clerkMiddleware() appends its own headers
 * to whatever response the handler returns (see `handlerResult.headers.append`
 * in its implementation), so — unlike the Auth0 middleware this replaced — no
 * manual cookie-copying is needed around the tenant rewrite.
 */
const clerkProxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const host = hostname.split(":")[0].toLowerCase();

  if (isPlatformPath(pathname)) {
    return NextResponse.next();
  }

  // The platform's own root domain serves the marketing site and the app.
  const isPlatformHost =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isPlatformHost) {
    return NextResponse.next();
  }

  let slug = slugFromPlatformHost(host);

  /**
   * A host that is neither the platform nor one of its subdomains can only be a
   * custom domain, so it is looked up. Resolution is cached (including the
   * negative answer) because this runs on every request, and only ACTIVE
   * domains resolve — serving a half-verified hostname would show visitors an
   * error page under the church's own name.
   */
  if (!slug && host.includes(".")) {
    slug = await resolveHostnameInProxy(host, request.nextUrl.origin);
  }

  if (!slug) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
});

/**
 * Entry point Next.js calls directly. Raw-body webhooks are filtered out
 * here, before `clerkProxy` (and the `authenticateRequest` network call
 * inside it) ever runs — see `RAW_BODY_WEBHOOKS` above.
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (RAW_BODY_WEBHOOKS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
