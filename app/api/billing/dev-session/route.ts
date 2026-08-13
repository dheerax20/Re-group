import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createDevSession } from "@/lib/auth-temp";

export const runtime = "nodejs";

const emailSchema = z.string().email();

/**
 * Dev-only login. Creates (or reuses) a TempUser, opens a session, and
 * redirects. Disabled entirely in production — see lib/auth-temp/README.md.
 *
 *   /api/billing/dev-session
 *   /api/billing/dev-session?email=a@b.com&next=/settings/billing
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawEmail = request.nextUrl.searchParams.get("email");
  let email: string | undefined;

  if (rawEmail) {
    const parsed = emailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    email = parsed.data;
  }

  await createDevSession(email);

  // Relative paths only — an absolute `next` would make this an open redirect.
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next =
    requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/upgrade";

  return NextResponse.redirect(new URL(next, request.nextUrl.origin));
}
