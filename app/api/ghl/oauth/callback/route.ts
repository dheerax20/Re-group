import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { exchangeAuthorizationCode, verifyOAuthState } from "@/lib/ghl/oauth";

export const runtime = "nodejs";

/**
 * Where GoHighLevel sends the browser back after the agency owner approves
 * the install.
 *
 * A full-page redirect, so there is no session-bound CSRF token the way a form
 * POST would carry one — the signed `state` stands in for it, and the session
 * is re-checked on top rather than trusted from the redirect alone. Both
 * checks, because either one alone is a way to bind someone else's GHL agency
 * to this deployment.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  if (searchParams.get("error")) {
    // They clicked Cancel. Not an error worth a stack trace.
    return NextResponse.json({ status: "cancelled" });
  }

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  if (!code || !stateParam) {
    return NextResponse.json({ error: "Missing code or state." }, { status: 400 });
  }

  const state = verifyOAuthState(stateParam);
  if (!state) {
    return NextResponse.json(
      { error: "That install link has expired. Start again from /api/ghl/oauth/start." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user || user.id !== state.userId || !isPlatformAdmin(user.email)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { companyId } = await exchangeAuthorizationCode(code);
    return NextResponse.json({
      status: "connected",
      companyId,
      next: "Run `npm run ghl:check` to confirm a location token can be minted.",
    });
  } catch (error) {
    // The token never reaches the browser, and neither does the client secret
    // — only what went wrong, which the operator needs in order to fix it.
    console.error("[ghl] oauth exchange failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The token exchange failed.",
      },
      { status: 502 }
    );
  }
}
