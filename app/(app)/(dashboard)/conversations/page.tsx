import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";
import { COURSES_SSO_URL, isGhlConfigured } from "@/lib/ghl/config";
import { ensureGhlAccount } from "@/lib/ghl/provision";

export const metadata = { title: "Conversations — Regroup" };


export default async function ConversationsPage() {
  const user = await syncCurrentUser();

  if (isGhlConfigured()) {
    const result = await ensureGhlAccount(user.id);
    if (!result.ok && !result.skipped) {
      // Don't dump them at an SSO page that cannot sign them in.
      console.error(`[conversations]  not ready for user ${user.id}: ${result.reason}`);
    }
  }

  redirect(COURSES_SSO_URL);
}
