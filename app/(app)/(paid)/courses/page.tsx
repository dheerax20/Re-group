import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";
import { COURSES_SSO_URL, isGhlConfigured } from "@/lib/ghl/config";
import { ensureGhlAccount } from "@/lib/ghl/provision";

export const metadata = { title: "Courses — Regroup" };

/**
 * Courses lives in GoHighLevel, reached over SSO (`ghl.md`). This route is the
 * handoff, and exists rather than pointing the sidebar straight at the SSO URL
 * so that:
 *
 *   - provisioning can be re-checked here. The Stripe webhook is the primary
 *     trigger, but if GHL was down at the moment of payment the user would
 *     otherwise land on an SSO page with no account behind it. `ensureGhlAccount`
 *     is idempotent, so this is a single indexed read in the normal case.
 *   - the third-party URL stays server-side and deployment-configurable
 *     instead of being baked into the client bundle.
 *
 * Already inside `(paid)`, so the plan gate is inherited.
 */
export default async function CoursesPage() {
  const user = await syncCurrentUser();

  if (isGhlConfigured()) {
    const result = await ensureGhlAccount(user.id);
    if (!result.ok && !result.skipped) {
      // Don't dump them at an SSO page that cannot sign them in.
      console.error(`[courses] GHL not ready for user ${user.id}: ${result.reason}`);
    }
  }

  redirect(COURSES_SSO_URL);
}
