import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createRegistration } from "@/lib/site/registrations";

/**
 * Public, unauthenticated RSVP submission — the visitor filling this form has
 * no session. Rate-limited by IP since there's no user to key on.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`rsvp:${eventId}:${ip}`, 5, 300);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, message: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const result = await createRegistration(eventId, body);

  if (!result.success) {
    const status =
      result.reason === "not_found" ? 404 : result.reason === "invalid" ? 400 : 409;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
