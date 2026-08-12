import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

/**
 * One Next.js app serves every church. A request to <slug>.regroup.app (or
 * <slug>.localhost:3000 in local dev) is rewritten internally to
 * /sites/<slug>/... — the public site route group never has to know how
 * the tenant was resolved. Requests to the bare root domain / localhost
 * fall through untouched to the platform (onboarding, builder, marketing).
 */
export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const host = hostname.split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/sites") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
