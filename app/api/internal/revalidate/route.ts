import { NextResponse, type NextRequest } from "next/server";
import { revalidateSitePaths } from "@/lib/site/invalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revalidates a site's public pages on behalf of a caller that has no request
 * scope of its own.
 *
 * `revalidatePath` only works inside a Next.js request. A Trigger.dev task is
 * its own process, so every call it makes throws and is swallowed
 * (`safeRevalidate`) — which meant a Slack edit wrote the database, cleared
 * Redis, and then left the published page serving stale ISR until its own
 * 300-second timer expired. The church was told the edit worked and saw
 * nothing change for five minutes, which is indistinguishable from the edit
 * having failed.
 *
 * So the task asks the app to do it. Same shared-secret guard as
 * `internal/hostname`, and for the same reason: the caller is our own
 * infrastructure and carries no cookies. Fails closed when the secret is
 * unset — an unauthenticated cache-busting endpoint is a free way to make a
 * church's site expensive to serve.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal/revalidate] INTERNAL_API_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let slug: unknown;
  let publicOnly: unknown;
  try {
    ({ slug, publicOnly } = (await request.json()) as Record<string, unknown>);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // A slug is a path segment we are about to interpolate into revalidatePath.
  if (typeof slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  revalidateSitePaths(slug, { publicOnly: publicOnly === true });
  return NextResponse.json({ revalidated: true });
}
