import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ghlAuthorizeUrl, isGhlOAuthConfigured, signOAuthState } from "@/lib/ghl/oauth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export const runtime = "nodejs";

/**
 * Starts the agency install.
 *
 * Unlike the Slack flow, this connects the PLATFORM's own GoHighLevel agency,
 * not a church's account — one install serves every site. So the gate is not
 * "owns this site" but "is one of us": `GHL_ADMIN_EMAILS`. A church admin who
 * finds this URL gets a 404, and with no admin list configured nobody can
 * reach it at all, which is the safe default for a route that grants
 * agency-wide access.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isPlatformAdmin(user.email)) {
    // 404 rather than 403: an unauthorized caller learns nothing about
    // whether this deployment has a GoHighLevel integration at all.
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isGhlOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "GHL_OAUTH_CLIENT_ID and GHL_OAUTH_CLIENT_SECRET are not set. Create the " +
          "marketplace app (Target User: Agency, Who can install: Agency Only) and " +
          "add its credentials before starting the install.",
      },
      { status: 503 }
    );
  }

  return NextResponse.redirect(ghlAuthorizeUrl(signOAuthState(user.id)));
}
