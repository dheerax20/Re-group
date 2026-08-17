import { redirect } from "next/navigation";
import { createDraftSite, resumeHref } from "@/lib/site/actions";
import { wizardHref } from "@/lib/onboarding/steps";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { syncCurrentUser } from "@/lib/auth/session";
import { requireActivePlan } from "@/lib/billing/guard";

async function startBuilder() {
  "use server";
  const result = await createDraftSite();
  if (!result?.siteId) redirect("/post-auth");
  if (result.existing) {
    redirect(await resumeHref(result.siteId));
  }
  redirect(wizardHref("church", result.siteId));
}

export default async function BuilderWizardStartPage() {
  const user = await syncCurrentUser();
  await requireActivePlan(user.id);
  if (user.site) {
    redirect(await resumeHref(user.site.id));
  }
  return <OnboardingWelcome startAction={startBuilder} />;
}
