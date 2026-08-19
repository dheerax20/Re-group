import { api } from "@/server/trpc/caller";
import { redirect } from "next/navigation";
import { wizardHref } from "@/lib/onboarding/steps";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";

async function startBuilder() {
  "use server";
  const result = await (await api()).site.createDraft();
  if (!result?.siteId) redirect("/post-auth");
  if (result.existing) {
    redirect(await (await api()).site.resumeHref({ siteId: result.siteId }));
  }
  redirect(wizardHref("church", result.siteId));
}

export default async function BuilderWizardStartPage() {
  const user = await syncCurrentUser();
  await requireActivePlan(user.id);
  if (user.site) {
    redirect(await (await api()).site.resumeHref({ siteId: user.site.id }));
  }
  return <OnboardingWelcome startAction={startBuilder} />;
}
