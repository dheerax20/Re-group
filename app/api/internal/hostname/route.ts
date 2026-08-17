import { NextResponse, type NextRequest } from "next/server";
import { lookupHostnameInDb } from "@/lib/domains/resolve";
import { normalizeHostname } from "@/lib/domains/hostname";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolves a custom hostname to a site slug for `proxy.ts`.
 *
 * The proxy needs this on every request to a custom domain, but it must not
 * carry a database client: Vercel may run it in a separate optimized
 * environment, and the Next.js docs are explicit that proxy code should not
 * rely on shared modules. So the proxy reads Redis, and only on a cache miss
 * calls this route, which owns the Prisma query and repopulates the cache.
 *
 * Guarded by a shared secret rather than a session, because the caller is our
 * own infrastructure and has no cookies. Without `INTERNAL_API_SECRET` set the
 * route refuses every request — it is better for custom domains to fail closed
 * than for this to become an open hostname-enumeration endpoint.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal/hostname] INTERNAL_API_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hostname = normalizeHostname(request.nextUrl.searchParams.get("host") ?? "");
  if (!hostname) {
    return NextResponse.json({ error: "Missing host" }, { status: 400 });
  }

  const slug = await lookupHostnameInDb(hostname);
  return NextResponse.json({ slug });
}
