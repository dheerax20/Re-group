import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
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

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

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
 * Auth0 session/OAuth routes plus multi-tenant hostname rewrites.
 * Always start from auth0.middleware() so /auth/* and session cookies stay intact.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * The Stripe webhook is unauthenticated by design — it is verified by
   * signature over the RAW request body, has no session to refresh, and no
   * cookies to set. Returning before auth0.middleware() keeps anything
   * session-related well away from a route where the body must arrive
   * byte-for-byte intact.
   */
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  const authResponse = await auth0.middleware(request);

  if (pathname.startsWith("/auth")) {
    return authResponse;
  }

  const hostname = request.headers.get("host") ?? "";
  const host = hostname.split(":")[0].toLowerCase();

  if (isPlatformPath(pathname)) {
    return authResponse;
  }

  // The platform's own root domain serves the marketing site and the app.
  const isPlatformHost =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isPlatformHost) {
    return authResponse;
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
    return authResponse;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${pathname === "/" ? "" : pathname}`;
  return copyCookies(authResponse, NextResponse.rewrite(url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
