import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  ACTIVE_SITE_COOKIE,
  BUILDER_WIZARD_SEGMENTS,
} from "@/lib/site/active-site";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

function withActiveSiteCookie(request: NextRequest, response: NextResponse) {
  const { pathname, searchParams } = request.nextUrl;
  const querySiteId = searchParams.get("siteId");

  let pathSiteId: string | null = null;
  const builderMatch = pathname.match(/^\/builder\/([^/]+)/);
  if (builderMatch && !BUILDER_WIZARD_SEGMENTS.has(builderMatch[1])) {
    pathSiteId = builderMatch[1];
  }

  const siteId = querySiteId || pathSiteId;
  if (siteId) {
    response.cookies.set(ACTIVE_SITE_COOKIE, siteId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

/**
 * Auth0 session/OAuth routes plus multi-tenant subdomain rewrites.
 * Always start from auth0.middleware() so /auth/* and session cookies stay intact.
 */
export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth")) {
    return authResponse;
  }

  const hostname = request.headers.get("host") ?? "";
  const host = hostname.split(":")[0].toLowerCase();

  if (
    pathname.startsWith("/sites") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return withActiveSiteCookie(request, authResponse);
  }

  let slug: string | null = null;

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const candidate = host.slice(0, -1 * (ROOT_DOMAIN.length + 1));
    if (candidate && candidate !== "www") slug = candidate;
  } else if (host.endsWith(".localhost")) {
    const candidate = host.slice(0, -".localhost".length);
    if (candidate && candidate !== "www") slug = candidate;
  }

  if (!slug) {
    return withActiveSiteCookie(request, authResponse);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${pathname === "/" ? "" : pathname}`;
  const rewrite = copyCookies(authResponse, NextResponse.rewrite(url));
  return withActiveSiteCookie(request, rewrite);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
